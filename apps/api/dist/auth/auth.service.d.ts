import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export interface AuthResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string;
    };
}
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(dto: RegisterDto): Promise<AuthResponse>;
    login(dto: LoginDto): Promise<AuthResponse>;
    validateUser(userId: string): Promise<{
        email: string;
        name: string;
        id: string;
        organizationId: string;
        createdAt: Date;
    }>;
}
