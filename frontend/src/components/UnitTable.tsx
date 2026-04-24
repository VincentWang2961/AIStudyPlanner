import styles from "./UnitTable.module.css";

interface Unit {
  code: string;
  name: string;
  semester: number;
  credits: number;
}

interface UnitTableProps {
  units: Unit[];
}

export default function UnitTable({ units }: UnitTableProps) {
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Unit Name</th>
            <th>Semester</th>
            <th>Credits</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr key={unit.code}>
              <td className={styles.code}>{unit.code}</td>
              <td className={styles.name}>{unit.name}</td>
              <td className={styles.semester}>{unit.semester}</td>
              <td className={styles.credits}>{unit.credits}cr</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
