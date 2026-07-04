import { Link } from "react-router-dom";
import { mockDiscussions, STATUS_COLOR, STATUS_LABEL } from "./dashboardData";
import styles from "./DashboardPage.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>讨论面板</h1>
        <Link to="/setup/new" className={styles.newBtn}>
          发起新讨论
        </Link>
      </header>

      <div className={`${styles.grid} scroll-container`}>
        {mockDiscussions.map((d) => (
          <Link
            key={d.id}
            to={d.status === "DRAFT" ? `/setup/${d.id}` : `/studio/${d.id}`}
            className={styles.card}
          >
            <span
              className={styles.statusTag}
              style={{ backgroundColor: STATUS_COLOR[d.status] }}
            >
              {STATUS_LABEL[d.status]}
            </span>

            <p className={styles.cardTopic}>{d.topic}</p>

            <div className={styles.cardMeta}>
              <span>👥 {d.participantCount} 人</span>
              <span>{d.createdAt}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
