import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCEwqOAmlgJGLIO6TcxuWxyH7WvW2u-Sfs",
  authDomain: "controle-chamados-b315d.firebaseapp.com",
  projectId: "controle-chamados-b315d",
  storageBucket: "controle-chamados-b315d.firebasestorage.app",
  messagingSenderId: "189053771521",
  appId: "1:189053771521:web:e01d45d666fcdbd7c2c500",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;