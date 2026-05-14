/**
 * An in-memory DataSource used exclusively by tests.
 * Uses sqljs with dropSchema:true so each test suite starts with a clean DB.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Task } from '../src/models/Task';
import { Result } from '../src/models/Result';
import { Workflow } from '../src/models/Workflow';
import initSqlJs from 'sql.js';

export const TestDataSource = new DataSource({
    type: 'sqljs',
    dropSchema: true,
    synchronize: true,
    logging: false,
    entities: [Task, Result, Workflow],
    driver: initSqlJs,
});
