import type {
  TaskUnitOfWork,
  TaskUnitOfWorkRepositories,
} from "@/modules/tasks/application/ports/task-unit-of-work";
import { type Task, Task as TaskEntity } from "@/modules/tasks/domain/entities/task";
import type { TaskStatusHistory } from "@/modules/tasks/domain/entities/task-status-history";
import type {
  ListTasksFilters,
  TaskListItem,
  TaskRepository,
} from "@/modules/tasks/domain/repositories/task-repository";
import type { TaskStatusHistoryRepository } from "@/modules/tasks/domain/repositories/task-status-history-repository";

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

export class InMemoryTaskUnitOfWork implements TaskUnitOfWork {
  readonly taskRepository: InMemoryTaskRepository;
  readonly historyRepository: InMemoryTaskStatusHistoryRepository;
  executeCalls = 0;

  constructor(
    taskRepository = new InMemoryTaskRepository(),
    historyRepository = new InMemoryTaskStatusHistoryRepository(),
  ) {
    this.taskRepository = taskRepository;
    this.historyRepository = historyRepository;
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

    try {
      return await work({ tasks: this.taskRepository, taskStatusHistory: this.historyRepository });
    } catch (error) {
      this.taskRepository.items.clear();
      for (const [id, task] of tasksSnapshot) this.taskRepository.items.set(id, task);
      this.historyRepository.items.length = 0;
      this.historyRepository.items.push(...historySnapshot);
      throw error;
    }
  }
}
