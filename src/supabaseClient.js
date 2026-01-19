import { createClient } from '@supabase/supabase-js'

// 這裡要填入你剛剛在 Supabase 網站拿到的兩把鑰匙
// 請將引號 '' 裡面的文字，換成你的 Project URL 和 Anon Key
const supabaseUrl = 'https://udqizfudrdsawrvukajy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkcWl6ZnVkcmRzYXdydnVrYWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODg4NzcsImV4cCI6MjA4NDM2NDg3N30.AXTda6WTmmRzkL-mU3C3-M2kNKSqX49z5MvguH2PqjQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)