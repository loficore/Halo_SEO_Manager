import fs from 'fs/promises';
import path from 'path';
import { LogEntry, LogLevel, GetLogsRequest, LogResponse } from '../types/log';
import { log, Modules } from '../logger';

const LOGS_DIR = path.resolve(__dirname, '../../logs'); // Adjusted path to correctly point to the logs directory

/**
 * @description 日志服务类，提供读取日志文件内容的逻辑。
 * @description English: Log service class, provides logic for reading log file content.
 */
export class LogService {
  constructor() {
    log('info', Modules.LogService, 'LogService initialized.');
  }

  /**
   * @description 获取日志文件路径。
   * @param moduleName 可选的模块名称。
   * @param date 可选的日期 (YYYY-MM-DD 格式)。
   * @returns 日志文件的完整路径。
   */
  private getLogFilePath(moduleName?: string, date?: string): string {
    const fileName = moduleName
      ? `${moduleName}.${date || new Date().toISOString().slice(0, 10)}.log`
      : `application.${date || new Date().toISOString().slice(0, 10)}.log`;
    return path.join(LOGS_DIR, fileName);
  }

  /**
   * @description 读取日志文件内容并解析为 LogEntry 数组。
   * @param filePath 日志文件路径。
   * @returns Promise<LogEntry[]> 解析后的日志条目数组。
   */
  private async readAndParseLogFile(filePath: string): Promise<LogEntry[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => {
          try {
            // Log format: [timestamp] [LEVEL] [MODULE] message { ...meta }
            const match = line.match(
              /^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.*)$/,
            );
            if (!match) {
              log(
                'warn',
                Modules.LogService,
                `Could not parse log line: ${line}`,
              );
              return null;
            }

            const [, timestamp, level, module, rest] = match;

            let message = rest;
            let meta: Record<string, any> = {};

            // Attempt to parse meta object if it exists at the end
            const jsonStartIndex = rest.lastIndexOf('{');
            if (jsonStartIndex !== -1) {
              try {
                const potentialJson = rest.substring(jsonStartIndex);
                meta = JSON.parse(potentialJson);
                message = rest.substring(0, jsonStartIndex).trim();
              } catch (jsonError) {
                // If parsing as JSON fails, treat the whole 'rest' as message
                message = rest;
              }
            }

            return {
              timestamp,
              level: level.toLowerCase() as LogLevel,
              module,
              message,
              ...meta,
            };
          } catch (parseError: any) {
            log(
              'error',
              Modules.LogService,
              `Error parsing log line: ${line}`,
              { error: parseError.message },
            );
            return null;
          }
        })
        .filter((entry): entry is LogEntry => entry !== null);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        log('debug', Modules.LogService, `Log file not found: ${filePath}`);
      } else {
        log(
          'error',
          Modules.LogService,
          `Error reading log file: ${filePath}`,
          { error: error.message },
        );
      }
      return [];
    }
  }

  /**
   * @description 获取系统日志（支持过滤和分页）。
   * @param options 获取日志的请求选项。
   * @returns Promise<LogResponse> 包含日志条目、总数、当前页和每页大小的响应对象。
   */
  async getLogs(options: GetLogsRequest): Promise<LogResponse> {
    const {
      level,
      module,
      startDate,
      endDate,
      search,
      page = 1,
      pageSize = 20,
    } = options;

    log('info', Modules.LogService, 'Fetching system logs with filters.', {
      level,
      module,
      startDate,
      endDate,
      search,
      page,
      pageSize,
    });

    let allEntries: LogEntry[] = [];
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // For simplicity, this implementation will read the log file for "today"
    // and for the specific module if provided.
    // A more advanced implementation would iterate through daily log files within a date range.

    const filePath = this.getLogFilePath(module, today); // Always try to read today's log for the module
    allEntries = await this.readAndParseLogFile(filePath);

    // If a module is not specified, also read the application log
    if (!module) {
      const appFilePath = this.getLogFilePath('application', today);
      const appEntries = await this.readAndParseLogFile(appFilePath);
      allEntries = [...allEntries, ...appEntries];
    }

    // Deduplicate entries if they appear in both (e.g., if module log also logs to application log)
    // For simplicity, we assume no exact duplicates across module and application logs for now
    // and prioritize module-specific logs if a module filter is present.

    let filteredEntries = allEntries;

    // Apply filters
    if (level) {
      filteredEntries = filteredEntries.filter(
        (entry) => entry.level === level.toLowerCase(),
      );
    }
    if (module) {
      filteredEntries = filteredEntries.filter(
        (entry) => entry.module.toLowerCase() === module.toLowerCase(),
      );
    }
    if (startDate) {
      const start = new Date(startDate);
      filteredEntries = filteredEntries.filter(
        (entry) => new Date(entry.timestamp) >= start,
      );
    }
    if (endDate) {
      const end = new Date(endDate);
      filteredEntries = filteredEntries.filter(
        (entry) => new Date(entry.timestamp) <= end,
      );
    }
    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredEntries = filteredEntries.filter(
        (entry) =>
          entry.message.toLowerCase().includes(lowerSearch) ||
          Object.values(entry).some(
            (value) =>
              typeof value === 'string' &&
              value.toLowerCase().includes(lowerSearch),
          ),
      );
    }

    const totalCount = filteredEntries.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

    log(
      'info',
      Modules.LogService,
      `Finished fetching logs. Total: ${totalCount}, Returned: ${paginatedEntries.length}.`,
    );

    return {
      entries: paginatedEntries,
      totalCount,
      currentPage: page,
      pageSize,
    };
  }
}
