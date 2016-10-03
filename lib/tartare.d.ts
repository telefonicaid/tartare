
declare var feature: Tartare.FeatureDefinition;
declare var scenario: Tartare.ScenarioDefinition;

declare var given: Tartare.StepDefinition;
declare var when: Tartare.StepDefinition;
declare var then: Tartare.StepDefinition;
declare var and: Tartare.StepDefinition;
declare var but: Tartare.StepDefinition;

declare function beforeAll(action: ActionFunction): void;
declare function beforeFeature(action: ActionFunction): void;
declare function beforeEachScenario(action: ActionFunction): void;
declare function beforeScenario(action: ActionFunction): void;
declare function beforeEachVariant(action: ActionFunction): void;
declare function afterEachVariant(action: ActionFunction): void;
declare function afterScenario(action: ActionFunction): void;
declare function afterEachScenario(action: ActionFunction): void;
declare function afterFeature(action: ActionFunction): void;
declare function afterAll(action: ActionFunction): void;

declare function getTartareOptions(optName: string): string;
declare function getTartareOptions(): { [key: string]: string; };
declare function synchronize(module: Object): void;
declare function promisize(module: Object): void;
declare function sleep(ms: number): void;
declare function sleep(ms: number, cb: () => any): void;


interface DoneFunction {
    (error?: any): any;
}

interface SpecFunction {
    (): void;
}

interface SpecWithVariantFunction {
    (variant: Tartare.Variant): void;
}

interface ActionFunction {
    (done: DoneFunction): any | PromiseLike<any>;
}

interface TartareOptions {
    // reporter name, defaults to `gherkin`
    reporter?: string;
    // reporter-specific options. It can be an object or a string with a list of key=value pairs separated by commas
    reporterOptions?: string | Object;
    // timeout in milliseconds
    timeout?: number;
    // bail on the first step failure
    bail?: boolean;
    // expression to filter tests with
    filter?: string;
    // set whether colors can be used on console reporters
    useColors?: boolean;
    // set the color theme to be used with the gherkin reporter
    theme?: 'dark' | 'clear';
    // enable interactive features
    interactive?: boolean;
    // enable timeouts
    enableTimeouts?: boolean;
}

declare class Tartare {
    constructor(options?: TartareOptions);

    addFiles(files: string | string[]): Tartare;
    run(onComplete?: (failures: number) => void): Tartare.Runner;
}

// Merge the Tartare class declaration with a module
declare namespace Tartare {
    /** Partial interface for Mocha's `Runnable` class */
    interface Runnable {
        title: string;
        fn: Function;
        async: boolean;
        sync: boolean;
        timedOut: boolean;
    }

    /** Partial interface for Mocha's `Suite` class */
    interface Suite {
        parent: Suite;
        title: string;

        fullTitle(): string;
        tag(tags: string[]): Suite;
        tag(...tags: string[]): Suite;
        minorBug(bugId: string): Suite;
        majorBug(bugId: string): Suite;
    }

    /** Partial interface for Mocha's `Test` class */
    interface Test extends Runnable {
        parent: Suite;
        pending: boolean;

        fullTitle(): string;
    }

    /** Partial interface for Mocha's `Runner` class */
    interface Runner {}

    interface FeatureDefinition {
        // Several signatures to support several subtitle parameters are needed
        // until https://github.com/Microsoft/TypeScript/issues/1360 is implemented
        (title: string, spec?: SpecFunction): Suite;
        (title: string, subtitle: string, spec?: SpecFunction): Suite;
        (title: string, subtitle1: string, subtitle2: string, spec?: SpecFunction): Suite;
        (title: string, subtitle1: string, subtitle2: string, subtitle3: string, spec?: SpecFunction): Suite;
        (title: string, subtitle1: string, subtitle2: string, subtitle3: string, subtitle4: string, spec?: SpecFunction): Suite;
        only(title: string, spec?: SpecFunction): Suite;
        only(title: string, subtitle: string, spec?: SpecFunction): Suite;
        only(title: string, subtitle1: string, subtitle2: string, spec?: SpecFunction): Suite;
        only(title: string, subtitle1: string, subtitle2: string, subtitle3: string, spec?: SpecFunction): Suite;
        only(title: string, subtitle1: string, subtitle2: string, subtitle3: string, subtitle4: string, spec?: SpecFunction): Suite;
        skip(title: string, spec?: SpecFunction): Suite;
        skip(title: string, subtitle: string, spec?: SpecFunction): Suite;
        skip(title: string, subtitle1: string, subtitle2: string, spec?: SpecFunction): Suite;
        skip(title: string, subtitle1: string, subtitle2: string, subtitle3: string, spec?: SpecFunction): Suite;
        skip(title: string, subtitle1: string, subtitle2: string, subtitle3: string, subtitle4: string, spec?: SpecFunction): Suite;
        manual: {
            (title: string, spec?: SpecFunction): Suite
            (title: string, subtitle: string, spec?: SpecFunction): Suite;
            (title: string, subtitle1: string, subtitle2: string, spec?: SpecFunction): Suite;
            (title: string, subtitle1: string, subtitle2: string, subtitle3: string, spec?: SpecFunction): Suite;
            (title: string, subtitle1: string, subtitle2: string, subtitle3: string, subtitle4: string, spec?: SpecFunction): Suite;
            skip(title: string, spec?: SpecFunction): Suite;
            skip(title: string, subtitle: string, spec?: SpecFunction): Suite;
            skip(title: string, subtitle1: string, subtitle2: string, spec?: SpecFunction): Suite;
            skip(title: string, subtitle1: string, subtitle2: string, subtitle3: string, spec?: SpecFunction): Suite;
            skip(title: string, subtitle1: string, subtitle2: string, subtitle3: string, subtitle4: string, spec?: SpecFunction): Suite
        };
    }

    interface Variant {
        desc?: string;
        only?: boolean;
        skip?: boolean;
        manual?: boolean;
        minorBug?: string;
        majorBug?: string;
        tag?: string | string[];
    }

    interface ScenarioDefinition {
        (title: string, spec?: SpecFunction): Suite;
        (title: string, dataset: Variant[], spec: SpecWithVariantFunction): Suite;
        only(title: string, spec?: SpecFunction): Suite;
        only(title: string, dataset: Variant[], spec: SpecWithVariantFunction): Suite;
        skip(title: string, spec?: SpecFunction): Suite;
        skip(title: string, dataset: Variant[], spec: SpecWithVariantFunction): Suite;
        manual: {
            (title: string, spec?: SpecFunction): Suite;
            (title: string, dataset: Variant[], spec: SpecWithVariantFunction): Suite;
            skip(title: string, spec?: SpecFunction): Suite;
            skip(title: string, dataset: Variant[], spec: SpecWithVariantFunction): Suite;
        };
    }

    interface StepDefinition {
        (title: string, action?: ActionFunction): Test;
        skip(title: string, action?: ActionFunction): Test;
        manual: {
            (title: string, action?: ActionFunction): Test;
            skip(title: string, action?: ActionFunction): Test;
        };
    }
}

interface RegExpConstructor {
    escape(s: string): string;
}

interface Function {
    dontSync?: boolean;
    dontPromisize?: boolean;
}

declare module 'tartare' {
    export = Tartare;
}
