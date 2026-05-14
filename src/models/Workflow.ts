import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Task } from './Task';
import { WorkflowStatus } from '../domain/WorkflowStatus';

@Entity({ name: 'workflows' })
export class Workflow {
    @PrimaryGeneratedColumn('uuid')
    workflowId!: string;

    @Column()
    clientId!: string;

    @Column({ default: WorkflowStatus.Initial })
    status!: WorkflowStatus;

    /**
     * Aggregated result written once the workflow reaches a terminal state
     * (Completed or Failed). Serialised JSON containing per-task outputs.
     */
    @Column({ nullable: true, type: 'text' })
    finalResult?: string | null;

    @OneToMany(() => Task, task => task.workflow, { eager: false })
    tasks!: Task[];
}
