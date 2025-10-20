import { Database } from 'sqlite';
import { 
    INSERT_SCHEDULED_TASK, 
    GET_SCHEDULED_TASK_BY_ID,
    GET_SCHEDULED_TASKS_BY_USER_ID,
    GET_ALL_SCHEDULED_TASKS,
    UPDATE_SCHEDULED_TASK,
    DELETE_SCHEDULED_TASK_BY_ID 
} from './scheduledTasks.sql';

export class ScheduledTaskTable {
    constructor(private db: Database) {}

    async createScheduledTask(task: { id: string; user_id: string; article_id: string; schedule_cron: string; llm_model: string; optimization_params: string; status: string }) {
        await this.db.run(INSERT_SCHEDULED_TASK, {
            id: task.id,
            user_id: task.user_id,
            article_id: task.article_id,
            schedule_cron: task.schedule_cron,
            llm_model: task.llm_model,
            optimization_params: task.optimization_params,
            status: task.status,
        });
    }

    async getScheduledTaskById(id: string) {
        return await this.db.get(GET_SCHEDULED_TASK_BY_ID, { id });
    }

    async getScheduledTasksByUserId(userId: string) {
        return await this.db.all(GET_SCHEDULED_TASKS_BY_USER_ID, { user_id: userId });
    }

    async getAllScheduledTasks() {
        return await this.db.all(GET_ALL_SCHEDULED_TASKS);
    }

    async updateScheduledTask(id: string, userId: string, updateData: { schedule_cron?: string; llm_model?: string; optimization_params?: string; status?: string }) {
        await this.db.run(UPDATE_SCHEDULED_TASK, {
            schedule_cron: updateData.schedule_cron,
            llm_model: updateData.llm_model,
            optimization_params: updateData.optimization_params,
            status: updateData.status,
            id,
            user_id: userId,
        });
    }

    async deleteScheduledTask(id: string, userId: string) {
        await this.db.run(DELETE_SCHEDULED_TASK_BY_ID, { id, user_id: userId });
    }
}