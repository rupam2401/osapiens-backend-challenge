/**
 * An in-memory DataSource used exclusively by tests.
 * Uses better-sqlite3 with `:memory:` so each test suite starts with a
 * fresh DB and there is no on-disk file to clean up.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Task } from '../src/models/Task';
import { Workflow } from '../src/models/Workflow';

export const TestDataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    dropSchema: true,
    synchronize: true,
    logging: false,
    entities: [Task, Workflow],
});
