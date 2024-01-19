export interface codeDefinition {
    value: string; // language slug
    text: string; // language name
    defaultCode: string; // default code
}

export interface Params {
    name: string;
    type: string;
}

export interface QuestionResult {
    id: number;
    titleSlug: string;
    content: string;
    stats: {
        totalAccepted: string;
        totalSubmission: string;
        totalAcceptedRaw: number;
        totalSubmissionRaw: number;
        acRate: string;
    }
    codeDefinition: codeDefinition[];
    sampleTestCase: string;
    enableTestMode: boolean;
    metaData: {
        name: string;
        params: Params[];
        return: {
            type: string;
        }
    }
}

export interface ErrorResponse {
    message: string;
}

export interface QuestionMetadata {
    questionID: number;
    questionTitle: string;
}

export interface Room {
    name: string;
    size: number;
    uuid: string;
    owner?: string;
    password?: string;
    members: string[];
    questionData: QuestionMetadata | null;
}

export interface SubmissionResult {
    error: string;
    status_code: number;
    lang: string;
    run_success: boolean;
    compile_error: string;
    full_compile_error: string;
    status_runtime: string;
    memory: number;
    question_id: string;
    task_finish_time: number;
    task_name: string;
    finished: boolean;
    total_correct: number;
    total_testcases: number;
    runtime_percentile: number;
    status_memory: string;
    memory_percentile: number;
    pretty_lang: string;
    submission_id: string;
    status_msg: string;
    state: string;
}
