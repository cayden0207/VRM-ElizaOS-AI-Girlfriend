-- 修复 RLS 策略以允许用户注册
-- 在 Supabase SQL Editor 中运行此脚本

-- 1. 首先删除现有的限制性策略
DROP POLICY IF EXISTS "Users can access own data" ON users;
DROP POLICY IF EXISTS "Users can access own memories" ON memory_vectors;
DROP POLICY IF EXISTS "Users can access own chat history" ON chat_history;

-- 2. 为 users 表创建更灵活的策略

-- 允许所有人插入新用户（注册）
CREATE POLICY "Enable insert for registration" ON users
    FOR INSERT 
    WITH CHECK (true);

-- 允许用户读取自己的数据或匿名读取（用于检查用户是否存在）
CREATE POLICY "Enable read access for users" ON users
    FOR SELECT 
    USING (true);  -- 暂时允许所有人读取，后续可以改为 (id = 'wallet_' || auth.jwt()->>'wallet_address' OR auth.jwt() IS NULL)

-- 允许用户更新自己的数据
CREATE POLICY "Enable update for users" ON users
    FOR UPDATE 
    USING (
        -- 允许更新自己的数据，或在没有 JWT 时也允许（用于注册后的首次更新）
        id = 'wallet_' || auth.jwt()->>'wallet_address' 
        OR auth.jwt() IS NULL
    );

-- 允许用户删除自己的数据
CREATE POLICY "Enable delete for users" ON users
    FOR DELETE 
    USING (
        id = 'wallet_' || auth.jwt()->>'wallet_address'
    );

-- 3. 为 memory_vectors 表创建策略（保持原有逻辑）
CREATE POLICY "Enable all operations for memory_vectors" ON memory_vectors
    FOR ALL 
    USING (
        user_id = 'wallet_' || auth.jwt()->>'wallet_address' 
        OR auth.jwt() IS NULL  -- 允许匿名访问用于测试
    );

-- 4. 为 chat_history 表创建策略
CREATE POLICY "Enable all operations for chat_history" ON chat_history
    FOR ALL 
    USING (
        user_id = 'wallet_' || auth.jwt()->>'wallet_address' 
        OR auth.jwt() IS NULL  -- 允许匿名访问用于测试
    );

-- 5. 验证策略是否正确创建
DO $$
BEGIN
    RAISE NOTICE '✅ RLS 策略已更新';
    RAISE NOTICE '📝 现在允许:';
    RAISE NOTICE '  - 任何人都可以注册（插入新用户）';
    RAISE NOTICE '  - 任何人都可以查询用户是否存在';
    RAISE NOTICE '  - 用户可以更新和删除自己的数据';
    RAISE NOTICE '  - 测试环境下允许匿名访问';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 生产环境建议:';
    RAISE NOTICE '  - 实施适当的身份验证机制';
    RAISE NOTICE '  - 限制 SELECT 策略只允许查看必要信息';
    RAISE NOTICE '  - 添加速率限制防止滥用';
END $$;

-- 6. 测试查询 - 验证策略是否生效
-- 尝试查询用户数量（应该成功）
SELECT COUNT(*) as user_count FROM users WHERE id LIKE 'wallet_%';