export declare class HealthController {
    healthCheck(): {
        status: string;
        timestamp: string;
        service: string;
        version: string;
    };
}
