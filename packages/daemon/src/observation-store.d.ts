import { type ObservationId } from "@ink-mirror/shared";
import type { Observation, RawObservation, CurationStatus } from "@ink-mirror/shared";
/**
 * Filesystem operations needed by ObservationStore.
 * Same interface pattern as EntryStore for consistency.
 */
export interface ObservationStoreFs {
    readdir(path: string): Promise<string[]>;
    readFile(path: string, encoding: "utf-8"): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    mkdir(path: string, opts: {
        recursive: true;
    }): Promise<void>;
}
export interface ObservationStore {
    save(entryId: string, raw: RawObservation): Promise<Observation>;
    list(): Promise<Observation[]>;
    get(id: ObservationId): Promise<Observation | undefined>;
    updateStatus(id: ObservationId, status: CurationStatus): Promise<Observation | undefined>;
}
export interface ObservationStoreDeps {
    observationsDir: string;
    fs?: ObservationStoreFs;
    now?: () => string;
}
/**
 * Serialize an observation to YAML.
 * Hand-rolled to avoid a YAML library dependency for a simple flat structure.
 */
export declare function toYaml(obs: Observation): string;
/**
 * Parse a YAML observation file back into an Observation.
 */
export declare function fromYaml(content: string): Observation | undefined;
export declare function createObservationStore(deps: ObservationStoreDeps): ObservationStore;
//# sourceMappingURL=observation-store.d.ts.map