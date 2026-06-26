export interface AppConfig {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptSaltRounds: number;
    systemApiSecretKey: string;
    demoTenantId: string;
    demoOwnerId: string;
}
export declare const config: AppConfig;
