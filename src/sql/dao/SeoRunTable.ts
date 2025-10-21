import { Database } from 'sqlite';
import {
  INSERT_SEO_RUN,
  GET_SEO_RUN_BY_ID,
  GET_SEO_RUNS_BY_USER_ID,
  UPDATE_SEO_RUN_STATUS_AND_REPORT,
  GET_ALL_SEO_RUNS,
} from './seoRuns.sql';

export class SeoRunTable {
  constructor(private db: Database) {}

  async createSeoRun(seoRun: {
    id: string;
    user_id: string;
    article_id: string;
    llm_model: string;
    optimization_params: string;
    status: string;
    start_time: Date;
    end_time?: Date;
    report?: string;
    error_message?: string;
    retry_count?: number;
  }) {
    await this.db.run(INSERT_SEO_RUN, {
      id: seoRun.id,
      user_id: seoRun.user_id,
      article_id: seoRun.article_id,
      llm_model: seoRun.llm_model,
      optimization_params: seoRun.optimization_params,
      status: seoRun.status,
      start_time: seoRun.start_time.toISOString(),
      end_time: seoRun.end_time ? seoRun.end_time.toISOString() : null,
      report: seoRun.report,
      error_message: seoRun.error_message,
      retry_count: seoRun.retry_count || 0,
    });
  }

  async getSeoRunById(id: string) {
    return await this.db.get(GET_SEO_RUN_BY_ID, { id });
  }

  async getSeoRunsByUserId(userId: string) {
    return await this.db.all(GET_SEO_RUNS_BY_USER_ID, { user_id: userId });
  }

  async updateSeoRunStatusAndReport(
    id: string,
    status: string,
    report: string | null,
    errorMessage: string | null,
  ) {
    await this.db.run(UPDATE_SEO_RUN_STATUS_AND_REPORT, {
      id,
      status,
      report,
      error_message: errorMessage,
      end_time: new Date(), // Assuming we want to set end_time to now
    });
  }

  async getAllSeoRuns() {
    return await this.db.all(GET_ALL_SEO_RUNS);
  }
}
