import { Account, Client, Databases, ID, Query, Storage } from 'appwrite'
import { runtimeConfig } from '../config/runtime'

export const appwriteClient = new Client()

if (runtimeConfig.appwriteEndpoint) {
  appwriteClient.setEndpoint(runtimeConfig.appwriteEndpoint)
}

if (runtimeConfig.appwriteProjectId) {
  appwriteClient.setProject(runtimeConfig.appwriteProjectId)
}

export const appwriteAccount = new Account(appwriteClient)
export const appwriteDatabases = new Databases(appwriteClient)
export const appwriteStorage = new Storage(appwriteClient)
export const appwriteId = ID
export const appwriteQuery = Query
