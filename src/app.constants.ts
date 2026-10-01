import { PatientEventStatus } from "@prisma/client";

export class AppConstants {
    public static readonly DEAD_LETTER_PAGE_SIZE = 100;
    
    public static readonly MAX_IDEMPOTENCY_KEY_LENGTH = 255;

    public static readonly RECONCILE_BATCH_SIZE = 500;

    public static readonly OBJECT_ID = /^[a-f\d]{24}$/i;
    
    public static readonly OPEN_STATUSES: PatientEventStatus[] = [
        PatientEventStatus.PENDING,
        PatientEventStatus.PROCESSING,
        PatientEventStatus.DEAD_LETTER,
    ];

    public static readonly PATIENT_LOCK_TOKEN = Symbol('PATIENT_LOCK');

    public static readonly EXTERNAL_PROCESSOR_TOKEN = Symbol('EXTERNAL_PROCESSOR');

    public static readonly CLOCK_TOKEN = Symbol('CLOCK');

    public static readonly APP_CONFIG_TOKEN = Symbol('APP_CONFIG');

    public static readonly PATIENT_QUEUE_TOKEN = Symbol('PATIENT_QUEUE');

    public static readonly PATIENT_QUEUE_NAME = 'patient-drain';

    public static readonly PATIENT_JOB_NAME = 'drain-patient';

    public static readonly QUEUED_STATES = new Set<string>([
        'active',
        'waiting',
        'delayed',
        'prioritized',
        'waiting-children',
        'paused',
    ]);

    public static readonly RELEASE_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    else
        return 0
    end
    `;

    public static readonly EXTEND_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
    else
        return 0
    end
    `;
}