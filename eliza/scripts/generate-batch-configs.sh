#!/bin/bash

# ElizaOS 批量配置生成脚本
# 为 25 个 VRM AI 女友角色生成 ElizaOS Agent 配置

echo "🚀 ElizaOS 角色配置批量生成工具"
echo "=" | tr '\n' '=' | head -c 50 && echo

# 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 创建必要目录
echo "📁 创建项目结构..."
mkdir -p {characters,bridge,config,tests,examples}

# 验证生成脚本存在
if [ ! -f "scripts/generate-character.js" ]; then
    echo "❌ 角色生成脚本未找到，请确保在正确的目录中运行"
    exit 1
fi

# 生成所有角色配置
echo "📝 开始生成 25 个角色的 ElizaOS 配置..."
node scripts/generate-character.js all

# 验证生成结果
echo
echo "🔍 验证生成结果..."
total_files=$(find characters -name "*.json" | wc -l)
echo "生成的配置文件数量: $total_files"

if [ "$total_files" -eq 25 ]; then
    echo "✅ 所有 25 个角色配置已成功生成"
else
    echo "⚠️ 预期 25 个文件，实际生成 $total_files 个"
fi

# 显示文件大小统计
echo
echo "📊 文件大小统计:"
total_size=0
for file in characters/*.json; do
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        size_kb=$((size / 1024))
        total_size=$((total_size + size))
        basename_file=$(basename "$file" .json)
        printf "  %-12s %3d KB\n" "$basename_file" "$size_kb"
    fi
done

total_size_kb=$((total_size / 1024))
echo "  总大小: ${total_size_kb} KB"

# 验证配置文件格式
echo
echo "🧪 验证配置文件格式..."
invalid_count=0

for file in characters/*.json; do
    if [ -f "$file" ]; then
        if ! node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
            echo "❌ $(basename "$file"): JSON 格式错误"
            invalid_count=$((invalid_count + 1))
        fi
    fi
done

if [ "$invalid_count" -eq 0 ]; then
    echo "✅ 所有配置文件 JSON 格式正确"
else
    echo "⚠️ 发现 $invalid_count 个格式错误的文件"
fi

# 生成角色列表文件
echo
echo "📋 生成角色索引文件..."
cat > characters/character-index.json << EOF
{
  "metadata": {
    "version": "1.0.0",
    "generated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "totalCharacters": $total_files,
    "framework": "ElizaOS",
    "project": "VRM AI Girlfriend"
  },
  "characters": [
$(for file in characters/*.json; do
    if [ -f "$file" ] && [ "$(basename "$file")" != "character-index.json" ]; then
        name=$(basename "$file" .json)
        echo "    \"$name\","
    fi
done | sed '$ s/,$//')
  ]
}
EOF

echo "✅ 角色索引文件已生成: characters/character-index.json"

# 创建测试脚本
echo
echo "🧪 生成验证测试脚本..."
cat > tests/validate-configs.js << 'EOF'
const fs = require('fs');
const path = require('path');

function validateCharacterConfig(configPath) {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // 检查必需字段
        const requiredFields = ['name', 'bio', 'lore', 'messageExamples', 'settings'];
        const missingFields = requiredFields.filter(field => !config[field]);
        
        if (missingFields.length > 0) {
            return { valid: false, error: `缺少字段: ${missingFields.join(', ')}` };
        }
        
        // 检查设置配置
        if (!config.settings.voice || !config.settings.voice.elevenlabs) {
            return { valid: false, error: '缺少语音配置' };
        }
        
        // 检查对话示例
        if (!Array.isArray(config.messageExamples) || config.messageExamples.length === 0) {
            return { valid: false, error: '缺少对话示例' };
        }
        
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

// 验证所有配置文件
const charactersDir = path.join(__dirname, '../characters');
const files = fs.readdirSync(charactersDir)
    .filter(file => file.endsWith('.json') && file !== 'character-index.json');

console.log('🔍 验证 ElizaOS 角色配置文件...\n');

let validCount = 0;
for (const file of files) {
    const filePath = path.join(charactersDir, file);
    const result = validateCharacterConfig(filePath);
    
    if (result.valid) {
        console.log(`✅ ${file.replace('.json', '')}: 配置有效`);
        validCount++;
    } else {
        console.log(`❌ ${file.replace('.json', '')}: ${result.error}`);
    }
}

console.log(`\n📊 验证结果: ${validCount}/${files.length} 个配置文件有效`);
process.exit(validCount === files.length ? 0 : 1);
EOF

echo "✅ 验证测试脚本已生成: tests/validate-configs.js"

# 运行验证测试
echo
echo "🧪 运行配置验证测试..."
node tests/validate-configs.js

# 生成使用示例
echo
echo "📚 生成使用示例..."
cat > examples/usage-example.js << 'EOF'
/**
 * ElizaOS 角色配置使用示例
 * 展示如何在 ElizaOS 中使用生成的角色配置
 */

const fs = require('fs');
const path = require('path');

// 加载角色配置
function loadCharacterConfig(characterName) {
    const configPath = path.join(__dirname, '../characters', `${characterName}.json`);
    if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    throw new Error(`角色 ${characterName} 的配置文件未找到`);
}

// 获取所有可用角色
function getAvailableCharacters() {
    const indexPath = path.join(__dirname, '../characters/character-index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    return index.characters;
}

// 示例：加载 Alice 角色配置
try {
    console.log('🎭 加载角色配置示例\n');
    
    const alice = loadCharacterConfig('alice');
    console.log(`角色名称: ${alice.name}`);
    console.log(`个人介绍: ${alice.bio.join(' ')}`);
    console.log(`语音 ID: ${alice.settings.voice.elevenlabs.voiceId}`);
    console.log(`对话示例数: ${alice.messageExamples.length}`);
    
    console.log('\n📋 所有可用角色:');
    const characters = getAvailableCharacters();
    characters.forEach((char, index) => {
        console.log(`  ${index + 1}. ${char}`);
    });
    
    console.log(`\n✅ 共 ${characters.length} 个角色配置可用`);
    
} catch (error) {
    console.error('❌ 示例运行失败:', error.message);
}
EOF

echo "✅ 使用示例已生成: examples/usage-example.js"

# 显示完成信息
echo
echo "🎉 ElizaOS 角色配置生成完成！"
echo "=" | tr '\n' '=' | head -c 50 && echo
echo
echo "📁 生成的文件:"
echo "  characters/          - 25 个角色配置文件"
echo "  characters/character-index.json  - 角色索引"
echo "  tests/validate-configs.js        - 配置验证脚本"
echo "  examples/usage-example.js        - 使用示例"
echo
echo "🚀 下一步操作:"
echo "  1. 运行 'node examples/usage-example.js' 查看使用示例"
echo "  2. 使用这些配置文件初始化 ElizaOS Runtime"
echo "  3. 集成到现有的 VRM AI 女友系统中"
echo
echo "💡 提示: 配置文件已针对中文用户和现有系统优化"