import { ConsoleLogger, LoggerService } from '@nestjs/common';
export declare class AppLogger extends ConsoleLogger implements LoggerService {
    redactSecrets(input: string): string;
    error(message: string, ...optionalParams: any[]): void;
    log(message: string, ...optionalParams: any[]): void;
    warn(message: string, ...optionalParams: any[]): void;
    debug(message: string, ...optionalParams: any[]): void;
    verbose(message: string, ...optionalParams: any[]): void;
}
export declare const appLogger: AppLogger;
