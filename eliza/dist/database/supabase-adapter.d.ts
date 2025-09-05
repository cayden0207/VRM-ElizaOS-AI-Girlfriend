import { IDatabaseAdapter, UUID, Account, Actor, Goal, Memory, Relationship, Room, Participant } from '@ai16z/eliza';
export declare class SupabaseDatabaseAdapter implements IDatabaseAdapter {
    private supabase;
    constructor();
    getRoom(roomId: UUID): Promise<Room | null>;
    createRoom(roomId: UUID): Promise<UUID>;
    getParticipantsForAccount(userId: UUID): Promise<Participant[]>;
    getParticipantUserState(roomId: UUID, userId: UUID): Promise<"FOLLOWED" | "MUTED" | null>;
    setParticipantUserState(roomId: UUID, userId: UUID, state: "FOLLOWED" | "MUTED" | null): Promise<void>;
    getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
    }): Promise<Memory[]>;
    searchMemories(params: {
        tableName: string;
        roomId: UUID;
        embedding: number[];
        match_threshold: number;
        match_count: number;
        unique?: boolean;
    }): Promise<Memory[]>;
    createMemory(memory: Memory, tableName: string): Promise<void>;
    removeMemory(memoryId: UUID, tableName: string): Promise<void>;
    removeAllMemories(roomId: UUID, tableName: string): Promise<void>;
    countMemories(roomId: UUID, unique?: boolean, tableName?: string): Promise<number>;
    getGoals(params: {
        roomId: UUID;
        userId?: UUID;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<Goal[]>;
    updateGoal(goal: Goal): Promise<void>;
    createGoal(goal: Goal): Promise<void>;
    removeGoal(goalId: UUID): Promise<void>;
    removeAllGoals(roomId: UUID): Promise<void>;
    createRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<boolean>;
    getRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<Relationship | null>;
    getRelationships(params: {
        userId: UUID;
    }): Promise<Relationship[]>;
    createAccount(account: Account): Promise<boolean>;
    getAccount(userId: UUID): Promise<Account | null>;
    createActor(actor: Actor): Promise<boolean>;
    getActor(params: {
        roomId: UUID;
        userId: UUID;
    }): Promise<Actor | null>;
}
export declare function createSupabaseAdapter(): Promise<SupabaseDatabaseAdapter>;
