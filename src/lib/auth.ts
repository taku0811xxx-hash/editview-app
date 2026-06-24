import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

export const registerEditor = async (email: string, password: string, displayName: string) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'editors', user.uid), {
    displayName,
    email,
    createdAt: serverTimestamp(),
  })
  return user
}
