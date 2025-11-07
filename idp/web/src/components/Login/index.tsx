import React, { useContext } from 'react';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import axios from 'axios';
import { validateNotEmpty } from '../../utils';
import { UserContext } from '../../contexts/UserContext'
import UserCredentials from '../../types/UserCredentials';
import styles from './index.module.css';

function getInitialValues(): UserCredentials {
  return ({
    username: '',
    password: '',
  })
}

function Login() {
  const { logIn } = useContext(UserContext);
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Login</h1>
      <div className={styles.formContainer}>
        <Formik
          initialValues={getInitialValues()}
          onSubmit={async (values, { setStatus, resetForm }) => {
            try {
              const response = await axios.post(`${process.env.REACT_APP_API_URL}/token`, values);
              if (response.status === 401) {
                setStatus('Invalid credentials')
              }
              if (response.status === 200) {
                logIn(response.data.token)
                resetForm();
              }
            } catch (e) {
              if ((e as Error).message === 'Request failed with status code 401') {
                setStatus('Invalid credentials')
              }
            }
          }}
        >
          {({ status }) => (
            <Form>
              <div className={styles.field}>
                <label htmlFor="username" className={styles.label}>Username</label>
                <Field id="username" name="username" validate={validateNotEmpty} />
                <ErrorMessage className={styles.errorMessage} name="username" component="div" />
              </div>
              <div className={styles.field}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <Field id="password" name="password" type="password" validate={validateNotEmpty} />
                <ErrorMessage className={styles.errorMessage} name="password" component="div" />
              </div>
              <div>{status}</div>
              <button className={styles.submitButton} type="submit">Log In</button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default Login;
