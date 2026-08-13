import type {
  TaskUnitOfWork,
  TaskUnitOfWorkRepositories,
} from "@/modules/tasks/application/ports/task-unit-of-work";
import { type Task, Task as TaskEntity } from "@/modules/tasks/domain/entities/task";
import {
  type TaskPauseInterval,
  TaskPauseInterval as TaskPauseIntervalEntity,
} from "@/modules/tasks/domain/entities/task-pause-interval";
import type { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import {
  type TimeEntry,
  TimeEntry as TimeEntryEntity,
} from "@/modules/tasks/domain/entities/time-entry";
import type { TaskPauseIntervalRepository } from "@/modules/tasks/domain/repositories/task-pause-interval-repository";
import type {
  ListTasksFilters,
  TaskListItem,
  TaskRepository,
} from "@/modules/tasks/domain/repositories/task-repository";
import type { TaskStatusHistoryRepository } from "@/modules/tasks/domain/repositories/task-status-history-repository";
import type { TimeEntryRepository } from "@/modules/tasks/domain/repositories/time-entry-repository";
import { BusinessRuleError } from "@/shared/errors/typed-errors";

export class InMemoryTaskRepository implements TaskRepository {
  readonly items = new Map<string, Task>();
  createCalls = 0;
  updateCalls = 0;
  findByIdCalls = 0;
  findByIdForUpdateCalls = 0;

  async create(task: Task): Promise<Task> {
    this.createCalls += 1;
    this.items.set(task.id, task);
    return task;
  }

  async findById(companyId: string, id: string): Promise<Task | null> {
    this.findByIdCalls += 1;
    const task = this.items.get(id);
    return task?.companyId === companyId ? task : null;
  }

  async findByIdForUpdate(companyId: string, id: string): Promise<Task | null> {
    this.findByIdForUpdateCalls += 1;
    const task = this.items.get(id);
    return task?.companyId === companyId ? task : null;
  }

  async update(task: Task): Promise<Task> {
    this.updateCalls += 1;
    this.items.set(task.id, task);
    return task;
  }

  async listByCompany(companyId: string, filters: ListTasksFilters = {}): Promise<TaskListItem[]> {
    return [...this.items.values()]
      .filter(
        (task) =>
          task.companyId === companyId &&
          (filters.status === undefined || task.status === filters.status) &&
          (filters.priority === undefined || task.priority === filters.priority) &&
          (filters.assigneeId === undefined || task.assigneeId === filters.assigneeId) &&
          (filters.requisitionId === undefined || task.requisitionId === filters.requisitionId) &&
          (filters.search === undefined ||
            task.title.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase())),
      )
      .map((task) => ({ task, assignee: null, requisition: null }));
  }
}

export class InMemoryTaskStatusHistoryRepository implements TaskStatusHistoryRepository {
  readonly items: TaskStatusHistory[] = [];
  createCalls = 0;
  failOnCreate = false;

  async create(history: TaskStatusHistory): Promise<TaskStatusHistory> {
    this.createCalls += 1;
    if (this.failOnCreate) throw new Error("Falha ao persistir histórico");
    this.items.push(history);
    return history;
  }

  async listByTask(companyId: string, taskId: string): Promise<TaskStatusHistory[]> {
    return this.items.filter((history) => history.taskId === taskId && companyId.length > 0);
  }
}

export class InMemoryTaskPauseIntervalRepository implements TaskPauseIntervalRepository {
  readonly items = new Map<string, TaskPauseInterval>();
  createCalls = 0;
  closeCalls = 0;
  findOpenByTaskForUpdateCalls = 0;
  failOnCreate = false;
  failOnClose = false;

  async create(interval: TaskPauseInterval): Promise<TaskPauseInterval> {
    this.createCalls += 1;
    if (this.failOnCreate) throw new Error("Falha ao persistir pausa");
    this.items.set(interval.id, interval);
    return interval;
  }

  async findOpenByTaskForUpdate(taskId: string): Promise<TaskPauseInterval | null> {
    this.findOpenByTaskForUpdateCalls += 1;
    const openIntervals = [...this.items.values()].filter(
      (interval) => interval.taskId === taskId && interval.endedAt === null,
    );
    if (openIntervals.length > 1) {
      throw new BusinessRuleError("Task possui múltiplos intervalos de pausa abertos");
    }
    return openIntervals[0] ?? null;
  }

  async close(interval: TaskPauseInterval): Promise<TaskPauseInterval> {
    this.closeCalls += 1;
    if (this.failOnClose) throw new Error("Falha ao fechar pausa");
    this.items.set(interval.id, interval);
    return interval;
  }
}

export class InMemoryTimeEntryRepository implements TimeEntryRepository {
  readonly items = new Map<string, TimeEntry>();
  createCalls = 0;
  failOnCreate = false;
  listCalls = 0;
  sumCalls = 0;

  async create(entry: TimeEntry): Promise<TimeEntry> {
    this.createCalls += 1;
    if (this.failOnCreate) throw new Error("Falha ao persistir apontamento");
    this.items.set(entry.id, entry);
    return entry;
  }

  async listByTask(companyId: string, taskId: string, limit: number): Promise<TimeEntry[]> {
    this.listCalls += 1;
    return [...this.items.values()]
      .filter((entry) => entry.companyId === companyId && entry.taskId === taskId)
      .sort(
        (left, right) =>
          left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
      )
      .slice(0, limit);
  }

  async sumDurationByTask(companyId: string, taskId: string): Promise<number> {
    this.sumCalls += 1;
    return [...this.items.values()]
      .filter((entry) => entry.companyId === companyId && entry.taskId === taskId)
      .reduce((total, entry) => total + entry.durationMinutes, 0);
  }
}

export class InMemoryTaskUnitOfWork implements TaskUnitOfWork {
  readonly taskRepository: InMemoryTaskRepository;
  readonly historyRepository: InMemoryTaskStatusHistoryRepository;
  readonly pauseIntervalRepository: InMemoryTaskPauseIntervalRepository;
  readonly timeEntryRepository: InMemoryTimeEntryRepository;
  executeCalls = 0;

  constructor(
    taskRepository = new InMemoryTaskRepository(),
    historyRepository = new InMemoryTaskStatusHistoryRepository(),
    pauseIntervalRepository = new InMemoryTaskPauseIntervalRepository(),
    timeEntryRepository = new InMemoryTimeEntryRepository(),
  ) {
    this.taskRepository = taskRepository;
    this.historyRepository = historyRepository;
    this.pauseIntervalRepository = pauseIntervalRepository;
    this.timeEntryRepository = timeEntryRepository;
  }

  async execute<T>(work: (repositories: TaskUnitOfWorkRepositories) => Promise<T>): Promise<T> {
    this.executeCalls += 1;
    const tasksSnapshot = new Map(
      [...this.taskRepository.items].map(([id, task]) => [
        id,
        TaskEntity.restore({
          id: task.id,
          companyId: task.companyId,
          requisitionId: task.requisitionId,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          assigneeId: task.assigneeId,
          startDate: task.startDate,
          plannedEndDate: task.plannedEndDate,
          completedAt: task.completedAt,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        }),
      ]),
    );
    const historySnapshot = [...this.historyRepository.items];
    const pauseIntervalsSnapshot = new Map(
      [...this.pauseIntervalRepository.items].map(([id, interval]) => [
        id,
        TaskPauseIntervalEntity.restore({
          id: interval.id,
          taskId: interval.taskId,
          startedAt: interval.startedAt,
          endedAt: interval.endedAt,
          durationSeconds: interval.durationSeconds,
        }),
      ]),
    );
    const timeEntriesSnapshot = new Map(
      [...this.timeEntryRepository.items].map(([id, entry]) => [
        id,
        TimeEntryEntity.restore({
          id: entry.id,
          companyId: entry.companyId,
          taskId: entry.taskId,
          userId: entry.userId,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt,
          durationMinutes: entry.durationMinutes,
          description: entry.description,
          createdAt: entry.createdAt,
        }),
      ]),
    );

    try {
      return await work({
        tasks: this.taskRepository,
        taskStatusHistory: this.historyRepository,
        taskPauseIntervals: this.pauseIntervalRepository,
        timeEntries: this.timeEntryRepository,
      });
    } catch (error) {
      this.taskRepository.items.clear();
      for (const [id, task] of tasksSnapshot) this.taskRepository.items.set(id, task);
      this.historyRepository.items.length = 0;
      this.historyRepository.items.push(...historySnapshot);
      this.pauseIntervalRepository.items.clear();
      for (const [id, interval] of pauseIntervalsSnapshot) {
        this.pauseIntervalRepository.items.set(id, interval);
      }
      this.timeEntryRepository.items.clear();
      for (const [id, entry] of timeEntriesSnapshot) {
        this.timeEntryRepository.items.set(id, entry);
      }
      throw error;
    }
  }
}
