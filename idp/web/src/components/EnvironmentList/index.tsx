import React from 'react';
import EnvironmentState from '../../types/EnvironmentState';
import AddEnvironmentForm from '../AddEnvironmentForm'
import Environment from '../Environment'
import styles from './index.module.css'

export default function EnvironmentList(props: { environments: EnvironmentState[] }) {
  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th>Environment</th>
            <th>Application</th>
            <th>Owner</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {props.environments.map((environment: EnvironmentState) => <Environment key={environment.name} data={environment} />)}
        </tbody>
      </table>
      <AddEnvironmentForm />
    </div>
  );
}
