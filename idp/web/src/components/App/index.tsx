import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EnvironmentState from '../../types/EnvironmentState';
import EnvironmentList from '../EnvironmentList'
import styles from './index.module.css'

const REFRESH_INTERVAL = 10

function App() {
  const [timeTilRefresh, setTimeTilRefresh] = useState(REFRESH_INTERVAL);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [environments, setEnvironments] = useState([] as EnvironmentState[]);

  const syncEnvironment = async () => {
    try {
      const rawEnvironments = await axios.get(`${process.env.REACT_APP_API_URL}/environments`, { responseType: 'json' });
      const transformedEnvironments: EnvironmentState[] = rawEnvironments.data.map((environment: any) => ({
        ...environment,
        name: environment.environment,
        config: Object.entries(environment.config).map(([key, value]: [string, unknown]) => ({
          name: key,
          value: value,
        })),
      }))
      setEnvironments(transformedEnvironments);
      setTimeTilRefresh(REFRESH_INTERVAL)
      setLastRefresh(Date.now())
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    const interval = setInterval(syncEnvironment, REFRESH_INTERVAL * 1000);
    syncEnvironment()
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeTilRefresh(t => Math.max(t - 1, 0));
    }, 1000);
    return () => clearTimeout(timer);
  });
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Internal Developer Platform (IDP)</h1>
        <aside className={styles.refresh}>
          <div>Last updated at <span className={styles.lastRefreshTime}>{(new Date(lastRefresh).toLocaleTimeString())}</span></div>
          <div className={styles.nextUpdate}>Next update in {timeTilRefresh}s</div>
        </aside>
      </div>
      <main className={styles.main}>
        <EnvironmentList environments={environments} />
      </main>
    </div>
  );
}

export default App;
