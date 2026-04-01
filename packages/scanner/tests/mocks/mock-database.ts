/**
 * Mock Prisma Client for database testing
 * Implements Prisma-like interface for in-memory testing
 */

type ScanRecord = {
  id: string;
  filePath: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | null;
  score: number;
  findings: any;
  createdAt: Date;
  updatedAt: Date;
};

type FindingRecord = {
  id: string;
  scanId: string;
  rule: string;
  severity: string;
  message: string;
  location: any;
  code: string;
  remediation: string;
  createdAt: Date;
};

export class MockPrismaClient {
  private scans: Map<string, ScanRecord>;
  private findings: Map<string, FindingRecord>;
  private idCounter: number;

  constructor() {
    this.scans = new Map();
    this.findings = new Map();
    this.idCounter = 1;
  }

  private generateId(): string {
    return `id_${this.idCounter++}_${Date.now()}`;
  }

  // Scan operations
  scan = {
    create: async (data: { data: Partial<ScanRecord> }): Promise<ScanRecord> => {
      const id = this.generateId();
      const now = new Date();
      const scan: ScanRecord = {
        id,
        filePath: data.data.filePath || '',
        status: data.data.status || 'pending',
        severity: data.data.severity || null,
        score: data.data.score || 0,
        findings: data.data.findings || [],
        createdAt: data.data.createdAt || now,
        updatedAt: data.data.updatedAt || now,
      };
      this.scans.set(id, scan);
      return scan;
    },

    findUnique: async (args: { where: { id: string } }): Promise<ScanRecord | null> => {
      return this.scans.get(args.where.id) || null;
    },

    findMany: async (args?: {
      where?: { status?: { in?: string[] }; severity?: string };
      orderBy?: { createdAt?: 'asc' | 'desc' };
      take?: number;
      skip?: number;
    }): Promise<ScanRecord[]> => {
      let results = Array.from(this.scans.values());

      // Filter by status
      if (args?.where?.status?.in) {
        results = results.filter((scan) => args.where!.status!.in!.includes(scan.status));
      }

      // Filter by severity
      if (args?.where?.severity) {
        results = results.filter((scan) => scan.severity === args.where!.severity);
      }

      // Order by
      if (args?.orderBy?.createdAt === 'desc') {
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else if (args?.orderBy?.createdAt === 'asc') {
        results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }

      // Pagination
      if (args?.skip) {
        results = results.slice(args.skip);
      }
      if (args?.take) {
        results = results.slice(0, args.take);
      }

      return results;
    },

    update: async (args: {
      where: { id: string };
      data: Partial<ScanRecord>;
    }): Promise<ScanRecord> => {
      const existing = this.scans.get(args.where.id);
      if (!existing) {
        throw new Error(`Scan not found: ${args.where.id}`);
      }

      const updated: ScanRecord = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      this.scans.set(args.where.id, updated);
      return updated;
    },

    deleteMany: async (args?: { where?: { status?: { in?: string[] } } }): Promise<{ count: number }> => {
      let count = 0;

      if (args?.where?.status?.in) {
        for (const [id, scan] of this.scans.entries()) {
          if (args.where.status.in.includes(scan.status)) {
            this.scans.delete(id);
            count++;
          }
        }
      } else {
        count = this.scans.size;
        this.scans.clear();
      }

      return { count };
    },

    count: async (args?: { where?: { status?: { in?: string[] } } }): Promise<number> => {
      if (!args?.where?.status?.in) {
        return this.scans.size;
      }

      return Array.from(this.scans.values()).filter((scan) =>
        args.where!.status!.in!.includes(scan.status)
      ).length;
    },
  };

  // Finding operations
  finding = {
    create: async (data: { data: Partial<FindingRecord> }): Promise<FindingRecord> => {
      const id = this.generateId();
      const now = new Date();
      const finding: FindingRecord = {
        id,
        scanId: data.data.scanId || '',
        rule: data.data.rule || '',
        severity: data.data.severity || '',
        message: data.data.message || '',
        location: data.data.location || {},
        code: data.data.code || '',
        remediation: data.data.remediation || '',
        createdAt: data.data.createdAt || now,
      };
      this.findings.set(id, finding);
      return finding;
    },

    findMany: async (args?: { where?: { scanId?: string } }): Promise<FindingRecord[]> => {
      let results = Array.from(this.findings.values());

      if (args?.where?.scanId) {
        results = results.filter((finding) => finding.scanId === args.where!.scanId);
      }

      return results;
    },

    deleteMany: async (args?: { where?: { scanId?: string } }): Promise<{ count: number }> => {
      let count = 0;

      if (args?.where?.scanId) {
        for (const [id, finding] of this.findings.entries()) {
          if (finding.scanId === args.where.scanId) {
            this.findings.delete(id);
            count++;
          }
        }
      } else {
        count = this.findings.size;
        this.findings.clear();
      }

      return { count };
    },
  };

  // Transaction support
  async $transaction<T>(
    callback: (tx: Omit<MockPrismaClient, '$transaction' | '$disconnect' | '$connect'>) => Promise<T>
  ): Promise<T> {
    return callback(this);
  }

  // Connection methods
  async $connect(): Promise<void> {
    // No-op for mock
  }

  async $disconnect(): Promise<void> {
    // No-op for mock
  }

  /**
   * Reset mock state (for test isolation)
   */
  reset(): void {
    this.scans.clear();
    this.findings.clear();
    this.idCounter = 1;
  }

  /**
   * Seed mock data for testing
   */
  seedScans(scans: Partial<ScanRecord>[]): void {
    for (const scan of scans) {
      const id = this.generateId();
      const now = new Date();
      const record: ScanRecord = {
        id,
        filePath: scan.filePath || '',
        status: scan.status || 'pending',
        severity: scan.severity || null,
        score: scan.score || 0,
        findings: scan.findings || [],
        createdAt: scan.createdAt || now,
        updatedAt: scan.updatedAt || now,
      };
      this.scans.set(id, record);
    }
  }

  /**
   * Get mock data stats
   */
  getStats(): { scans: number; findings: number } {
    return {
      scans: this.scans.size,
      findings: this.findings.size,
    };
  }
}

// Export as default for convenience
export default MockPrismaClient;
