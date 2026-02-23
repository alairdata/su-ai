-- AI Memory System Migration
-- Run this in your Supabase SQL Editor

-- =============================================
-- SECTION 1: Create user_memories table
-- =============================================

CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'context' CHECK (category IN ('personal', 'preference', 'interest', 'context')),
  source_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  embedding_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, embedding_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_category ON user_memories(user_id, category);

-- =============================================
-- SECTION 2: Create chat_summaries table
-- =============================================

CREATE TABLE IF NOT EXISTS chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_summaries_chat_id ON chat_summaries(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_summaries_user_id ON chat_summaries(user_id);
  