import { CurationPanel } from "@/components/curation-panel";
import styles from "./page.module.css";

export default function CuratePage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Curate Observations</h1>
      <CurationPanel />
    </div>
  );
}
