import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Workflow } from './Workflow';
import { TaskStatus } from '../workers/taskRunner';

@Entity({ name: 'tasks' })
export class Task {
    @PrimaryGeneratedColumn('uuid')
    taskId!: string;

    @Column()
    clientId!: string;

    @Column('text')
    geoJson!: string;

    @Column()
    status!: TaskStatus;

    @Column({ nullable: true, type: 'text' })
    progress?: string | null;

    @Column({ nullable: true })
    resultId?: string;

    @Column()
    taskType!: string;

    @Column({ default: 1 })
    stepNumber!: number;

    /** Serialised JSON output written by the job after successful execution. */
    @Column({ nullable: true, type: 'text' })
    output?: string | null;

    /**
     * taskId of the task this one depends on (must be Completed before this
     * task is eligible to run). Null means no dependency.
     */
    @Column({ nullable: true, type: 'varchar' })
    dependsOnTaskId?: string | null;

    @ManyToOne(() => Workflow, workflow => workflow.tasks, { eager: false })
    workflow!: Workflow;
}
