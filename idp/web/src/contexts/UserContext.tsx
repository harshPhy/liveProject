import React, { createContext, FunctionComponent, useEffect, useState } from "react";
import { openDB } from 'idb';

const indexDBName = 'buildit_idp';

type UserState = {
    loaded: boolean
    username: string
    token: string
}

const defaultUserState: UserState = {
    loaded: false,
    username: "",
    token: "",
}

const UserContext = createContext({
    userState: defaultUserState,
    logIn: (token: string) => {},
    logOut: () => {},
});

const UserProvider: FunctionComponent = ({ children }) => {

    const [userState, setUserState] = useState(defaultUserState);

    const loadUserStateFromIndexedDB = async () => {
        const db = await openDB(indexDBName, 1, {
            upgrade(db) {
                db.createObjectStore('users', { keyPath: 'username' });
            }
        });
        const tx = db.transaction('users', 'readonly');
        const value = await tx.store.getAll();
        const newUserState = value.length > 0 ? value[0] : userState
        setUserState({
            ...newUserState,
            loaded: true,
        })
    }

    const persistUserStateToIndexedDB = async (userState: UserState) => {
        const db = await openDB(indexDBName, 1, {
            upgrade(db) {
                db.createObjectStore('users', { keyPath: 'username' });
            }
        });
        const tx = db.transaction('users', 'readwrite');
        await Promise.all([
            tx.store.put({
                username: userState.username,
                token: userState.token,
            }),
            tx.done
        ]);
    }


    const removeUserFromIndexedDB = async (username: string) => {
      const db = await openDB(indexDBName, 1, {
          upgrade(db) {
              db.createObjectStore('users', { keyPath: 'username' });
          }
      });
      const tx = db.transaction('users', 'readwrite');
      await Promise.all([
          tx.store.delete(username),
          tx.done
      ]);
    }

    const defaultUserContext = {
        userState,
        logIn: (token: string) => {
          const username = JSON.parse(atob(token.split(".")[1])).sub;
          setUserState({username, token, loaded: true})
          persistUserStateToIndexedDB({ username, token, loaded: true })
        },
        logOut: () => {
            setUserState({...defaultUserState, loaded: true})
            removeUserFromIndexedDB(userState.username)
        },
      }
    useEffect(() => {
        loadUserStateFromIndexedDB()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <UserContext.Provider value={defaultUserContext}>
            {children}
        </UserContext.Provider>
    )
}

export {
    UserProvider as default,
    UserContext,
};
