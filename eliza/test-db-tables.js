#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkDatabaseTables() {
    console.log('🔍 检查Supabase数据库表结构...');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ 缺少Supabase配置');
        return;
    }

    console.log(`📡 连接到: ${supabaseUrl}`);
    console.log(`🔑 使用密钥: ${supabaseKey ? supabaseKey.slice(0, 20) + '...' : 'None'}`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 检查所有表是否存在
    const requiredTables = [
        'accounts', 'rooms', 'participants', 'memories', 'memory_vectors',
        'relationships', 'goals', 'logs', 'ai_girlfriend_relationships',
        'ai_girlfriend_user_profiles', 'documents', 'fragments'
    ];

    console.log('\n📋 检查必需的表:');

    for (const tableName of requiredTables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log(`❌ ${tableName}: 表为空或不存在`);
                } else if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
                    console.log(`❌ ${tableName}: 表不存在 - ${error.message}`);
                } else {
                    console.log(`⚠️  ${tableName}: 其他错误 - ${error.message}`);
                }
            } else {
                console.log(`✅ ${tableName}: 存在 (记录数: ${data ? data.length : 0})`);
            }
        } catch (e) {
            console.log(`❌ ${tableName}: 异常 - ${e.message}`);
        }
    }

    // 特别检查documents表结构
    console.log('\n🔍 检查documents表结构:');
    try {
        const { data, error } = await supabase.rpc('exec', {
            sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents' ORDER BY ordinal_position`
        });

        if (error) {
            console.log('❌ 无法查询documents表结构:', error.message);
        } else if (data && data.length > 0) {
            console.log('✅ documents表结构:');
            data.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type}`);
            });
        } else {
            console.log('❌ documents表不存在或为空');
        }
    } catch (e) {
        console.log('❌ 查询documents表结构异常:', e.message);
    }
}

checkDatabaseTables().catch(console.error);