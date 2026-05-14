import { DataSource } from 'typeorm';
import { Task } from './models/Task';
import { Result } from './models/Result';
import { Workflow } from './models/Workflow';
import initSqlJs from 'sql.js';

export const AppDataSource = new DataSource({
    type: 'sqljs',
    autoSave: true,
    location: 'data/database.sqlite',
    dropSchema: false,
    entities: [Task, Result, Workflow],
    synchronize: true,
    logging: false,
    driver: initSqlJs,
});
