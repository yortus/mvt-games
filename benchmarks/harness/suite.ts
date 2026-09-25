// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A parameter value passed to one case, as it appears in the results. */
export type ParamValue = string | number;

/** One measured configuration of a suite. Run in its own process. */
export interface Case {
    readonly params: Readonly<Record<string, ParamValue>>;
    /** Extra Node flags for this case's process, on top of the suite's. */
    readonly nodeArgs?: readonly string[];
}

/** A metric shown as its own column. */
export interface MetricColumn {
    /** The key in each case's reported metrics. */
    readonly key: string;
    /** Column heading, including the unit. */
    readonly title: string;
    /** At most this many decimal places, before rounding to 3 significant figures. Default 2. */
    readonly maxDecimals?: number;
}

/**
 * One table in the printed and saved results. Either one `metric`, with the
 * values of the `column` param as its columns, or several `metrics` side by
 * side, one row per case.
 */
export interface TableSpec {
    /** Stable id, used as the region name in the saved markdown. */
    readonly id: string;
    readonly title: string;
    /** Only cases whose params match all of these. */
    readonly where?: Readonly<Record<string, ParamValue>>;
    /** Params that label each row, in order. */
    readonly rows: readonly string[];

    /** The key in each case's reported metrics that this table shows. */
    readonly metric?: string;
    readonly unit?: string;
    /** The param whose values become the columns. */
    readonly column?: string;
    /** At most this many decimal places, before rounding to 3 significant figures. Default 2. */
    readonly maxDecimals?: number;

    /** Several metrics as columns, in place of `metric` and `column`. */
    readonly metrics?: readonly MetricColumn[];
}

/**
 * A benchmark suite. The definition is plain data and imports nothing that is
 * measured; `entry` is the file each case's process runs, bundled first.
 */
export interface Suite {
    readonly name: string;
    readonly description: string;
    /** The measured file, relative to `benchmarks/suites/`. */
    readonly entry: string;
    readonly nodeArgs?: readonly string[];
    /** Processes per case. Default 3. */
    readonly runs?: number;
    readonly cases: readonly Case[];
    readonly tables: readonly TableSpec[];
    /** Labels for param values in printed tables, e.g. `{ dynamicProperties: { 1: '1 dynamic, 2 static' } }`. */
    readonly labels?: Readonly<Record<string, Readonly<Record<string, string>>>>;
    /** Row headings for params, where the driver's defaults do not fit. */
    readonly titles?: Readonly<Record<string, string>>;
}

/** Every combination of the given param values, in the order given. */
export function combinations(axes: Readonly<Record<string, readonly ParamValue[]>>): Record<string, ParamValue>[] {
    const keys = Object.keys(axes);
    let result: Record<string, ParamValue>[] = [{}];
    for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        const values = axes[key];
        const next: Record<string, ParamValue>[] = [];
        for (let r = 0; r < result.length; r++) {
            for (let v = 0; v < values.length; v++) {
                next.push({ ...result[r], [key]: values[v] });
            }
        }
        result = next;
    }
    return result;
}
