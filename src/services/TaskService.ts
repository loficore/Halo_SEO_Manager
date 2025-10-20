import { DatabaseManager } from '../database';
import { OptimizationService } from './OptimizationService.js'; // Assuming OptimizationService will be created
import { Scheduler } from '../scheduler'; // Assuming Scheduler will be used for task scheduling
import {
  CreateTaskRequest,
  TaskResponse,
  UpdateTaskRequest,
  TaskStatus,
} from '../types/task';
import { log } from '../logger';
import crypto from 'crypto';

/**
 * @description 任务服务类，处理优化任务的创建、读取、更新、删除和调度逻辑。
 * @description English: Task service class, handles creation, reading, updating, deleting, and scheduling logic for optimization tasks.
 */
export class TaskService {
  private dbManager: DatabaseManager;
  private optimizationService: OptimizationService;
  private scheduler: Scheduler; // Assuming scheduler will handle the actual cron scheduling

  /**
   * @description 构造函数，注入 DatabaseManager 和 OptimizationService 依赖。
   * @param dbManager 数据库管理器实例
   * @param optimizationService 优化服务实例
   * @param scheduler 调度器实例
   */
  constructor(
    dbManager: DatabaseManager,
    optimizationService: OptimizationService,
    scheduler: Scheduler,
  ) {
    this.dbManager = dbManager;
    this.optimizationService = optimizationService;
    this.scheduler = scheduler;
  }

  /**
   * @description 创建并调度一个新的优化任务。
   * @param createTaskRequest 创建任务的请求数据
   * @returns Promise<TaskResponse> 新创建的任务响应对象
   */
  async createTask(
    createTaskRequest: CreateTaskRequest,
  ): Promise<TaskResponse> {
    log('info', 'TaskService', 'Attempting to create a new task.', {
      userId: createTaskRequest.userId,
      articleId: createTaskRequest.articleId,
    });
    try {
      // 准备创建任务所需的数据
      const taskId = crypto.randomUUID();
      const taskData = {
        id: taskId,
        user_id: createTaskRequest.userId,
        article_id: createTaskRequest.articleId,
        schedule_cron: createTaskRequest.scheduleCron,
        llm_model: createTaskRequest.llmModel,
        optimization_params: JSON.stringify(
          createTaskRequest.optimizationParams,
        ),
        status: TaskStatus.PENDING,
      };

      // 使用新的 DAO 层创建任务
      await this.dbManager.scheduledTasks.createScheduledTask(taskData);

      // 创建后从数据库获取完整的任务信息
      const newTask =
        await this.dbManager.scheduledTasks.getScheduledTaskById(taskId);
      if (!newTask) {
        throw new Error('Failed to retrieve the created task.');
      }

      // 立即使用调度器安排任务
      // 调度器的角色是根据其 scheduleCron 从数据库中选取任务
      // 如果 cron 表达式更改，这可能涉及重新调度，或者如果是一次性任务，则添加到队列中进行即时处理。
      // 目前，假设调度器定期查询数据库中的 PENDING 任务。
      // 或者，我们可以直接告诉调度器添加这个特定任务。
      // 为简单起见，我们假设调度器定期查询数据库中的 PENDING 任务。
      // 更健壮的解决方案可能涉及消息队列或直接与调度器的 API 通信。

      log(
        'info',
        'TaskService',
        `Task created and scheduled successfully: ${newTask.id}`,
        { taskId: newTask.id },
      );
      return newTask;
    } catch (error: any) {
      log(
        'error',
        'TaskService',
        `Failed to create task for article ID ${createTaskRequest.articleId}:`,
        {
          userId: createTaskRequest.userId,
          articleId: createTaskRequest.articleId,
          error: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 获取指定用户的所有优化任务列表。
   * @param userId 用户ID
   * @returns Promise<TaskResponse[]> 任务响应对象数组
   */
  async getTasksByUserId(userId: string): Promise<TaskResponse[]> {
    log('info', 'TaskService', `Fetching tasks for user ID: ${userId}.`);
    try {
      // 使用新的 DAO 层获取用户任务
      const tasks =
        await this.dbManager.scheduledTasks.getScheduledTasksByUserId(userId);
      log(
        'info',
        'TaskService',
        `Retrieved ${tasks.length} tasks for user ID: ${userId}.`,
        { userId, count: tasks.length },
      );
      return tasks;
    } catch (error: any) {
      log(
        'error',
        'TaskService',
        `Failed to retrieve tasks for user ID ${userId}:`,
        {
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 获取所有优化任务列表。
   * @returns Promise<TaskResponse[]> 任务响应对象数组
   */
  async getAllTasks(): Promise<TaskResponse[]> {
    log('info', 'TaskService', 'Fetching all tasks.');
    try {
      // 使用新的 DAO 层获取所有任务
      const tasks = await this.dbManager.scheduledTasks.getAllScheduledTasks();
      log('info', 'TaskService', `Retrieved ${tasks.length} tasks.`, {
        count: tasks.length,
      });
      return tasks;
    } catch (error: any) {
      log('error', 'TaskService', 'Failed to retrieve all tasks:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * @description 根据任务ID获取优化任务详情。
   * @param taskId 任务ID
   * @returns Promise<TaskResponse | null> 任务响应对象，如果未找到则为null
   */
  async getTaskById(taskId: string): Promise<TaskResponse | null> {
    log('info', 'TaskService', `Fetching task by ID: ${taskId}.`);
    try {
      // 使用新的 DAO 层根据 ID 获取任务
      const task =
        await this.dbManager.scheduledTasks.getScheduledTaskById(taskId);
      if (task) {
        log('info', 'TaskService', `Task found with ID: ${taskId}.`, {
          taskId,
        });
      } else {
        log('warn', 'TaskService', `Task not found with ID: ${taskId}.`, {
          taskId,
        });
      }
      return task;
    } catch (error: any) {
      log('error', 'TaskService', `Failed to retrieve task by ID ${taskId}:`, {
        taskId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * @description 更新指定ID的优化任务。
   * @param taskId 任务ID
   * @param userId 执行更新的用户ID
   * @param updateTaskRequest 更新任务的请求数据
   * @returns Promise<void>
   */
  async updateTask(
    taskId: string,
    userId: string,
    updateTaskRequest: UpdateTaskRequest,
  ): Promise<void> {
    log(
      'info',
      'TaskService',
      `Attempting to update task ID: ${taskId} by user: ${userId}.`,
    );
    try {
      // 使用新的 DAO 层更新任务
      await this.dbManager.scheduledTasks.updateScheduledTask(
        taskId,
        userId,
        updateTaskRequest,
      );
      log('info', 'TaskService', `Task ID: ${taskId} updated successfully.`);
      // If scheduleCron changes, the scheduler needs to be notified to update its cron job
      // For simplicity, assuming scheduler re-reads tasks periodically.
    } catch (error: any) {
      log(
        'error',
        'TaskService',
        `Failed to update task ID ${taskId} by user ${userId}:`,
        {
          taskId,
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 删除指定ID的优化任务。
   * @param taskId 任务ID
   * @param userId 执行删除的用户ID
   * @returns Promise<void>
   */
  async deleteTask(taskId: string, userId: string): Promise<void> {
    log(
      'info',
      'TaskService',
      `Attempting to delete task ID: ${taskId} by user: ${userId}.`,
    );
    try {
      // 使用新的 DAO 层删除任务
      await this.dbManager.scheduledTasks.deleteScheduledTask(taskId, userId);
      log('info', 'TaskService', `Task ID: ${taskId} deleted successfully.`);
      // The scheduler would need to be notified to remove this task from its active jobs.
    } catch (error: any) {
      log(
        'error',
        'TaskService',
        `Failed to delete task ID ${taskId} by user ${userId}:`,
        {
          taskId,
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 调度一个任务。
   * @param taskId 任务ID
   * @returns Promise<void>
   */
  async scheduleTask(taskId: string): Promise<void> {
    log('info', 'TaskService', `Attempting to schedule task ID: ${taskId}.`);
    try {
      // 使用新的 DAO 层获取任务并更新状态
      const task =
        await this.dbManager.scheduledTasks.getScheduledTaskById(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found.`);
      }
      // 假设调度器有明确添加/更新计划任务的方法
      // this.scheduler.addOrUpdateTask(task);
      // 目前，我们只需将其状态更新为 PENDING，并依赖调度器来获取它。
      await this.dbManager.scheduledTasks.updateScheduledTask(
        taskId,
        task.userId,
        {
          status: TaskStatus.PENDING,
        },
      );
      log('info', 'TaskService', `Task ID: ${taskId} scheduled successfully.`);
    } catch (error: any) {
      log('error', 'TaskService', `Failed to schedule task ID ${taskId}:`, {
        taskId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * @description 取消一个任务。
   * @param taskId 任务ID
   * @param userId 执行取消的用户ID
   * @returns Promise<void>
   */
  async cancelTask(taskId: string, userId: string): Promise<void> {
    log(
      'info',
      'TaskService',
      `Attempting to cancel task ID: ${taskId} by user: ${userId}.`,
    );
    try {
      // 使用新的 DAO 层取消任务
      await this.dbManager.scheduledTasks.updateScheduledTask(taskId, userId, {
        status: TaskStatus.CANCELLED,
      });
      log('info', 'TaskService', `Task ID: ${taskId} cancelled successfully.`);
      // 通知调度器从活动调度中移除此任务。
    } catch (error: any) {
      log(
        'error',
        'TaskService',
        `Failed to cancel task ID ${taskId} by user ${userId}:`,
        {
          taskId,
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 获取任务状态。
   * @param taskId 任务ID
   * @returns Promise<TaskStatus | null> 任务状态，如果未找到则为null
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    log('info', 'TaskService', `Getting status for task ID: ${taskId}.`);
    try {
      // 使用新的 DAO 层获取任务状态
      const task =
        await this.dbManager.scheduledTasks.getScheduledTaskById(taskId);
      if (task) {
        log(
          'info',
          'TaskService',
          `Status for task ID ${taskId}: ${task.status}.`,
          { taskId, status: task.status },
        );
        return task.status;
      }
      log(
        'warn',
        'TaskService',
        `Task not found with ID: ${taskId}, cannot get status.`,
      );
      return null;
    } catch (error: any) {
      log(
        'error',
        'TaskService',
        `Failed to get status for task ID ${taskId}:`,
        {
          taskId,
          error: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 更新任务状态。
   * @param taskId 任务ID
   * @param newStatus 新的任务状态
   * @returns Promise<void>
   */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
    log(
      'info',
      'TaskService',
      `Updating status for task ID: ${taskId} to ${newStatus}.`,
    );
    try {
      // 使用新的 DAO 层更新任务状态
      const task =
        await this.dbManager.scheduledTasks.getScheduledTaskById(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found.`);
      }
      await this.dbManager.scheduledTasks.updateScheduledTask(
        taskId,
        task.userId,
        {
          status: newStatus,
        },
      );
      log(
        'info',
        'TaskService',
        `Task ID: ${taskId} status updated to ${newStatus}.`,
      );
    } catch (error: any) {
      log(
        'error',
        'TaskService',
        `Failed to update status for task ID ${taskId} to ${newStatus}:`,
        {
          taskId,
          newStatus,
          error: error.message,
          stack: error.stack,
        },
      );
      throw error;
    }
  }
}
