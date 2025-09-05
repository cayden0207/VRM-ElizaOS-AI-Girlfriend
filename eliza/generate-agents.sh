#!/bin/bash

# ElizaOS Agent 配置生成脚本
# 基于 character.md 批量生成 25 个角色的 Agent 配置

echo "📝 开始生成 ElizaOS Agent 配置文件..."

# 确保目录存在
mkdir -p ./eliza/agents

# 25个角色列表（基于 character.md）
characters=(
    "Alice" "Ash" "Bobo" "Elinyaa" "Fliza" 
    "Imeris" "Kyoko" "Lena" "Lilium" "Maple" 
    "Miru" "NEKONA" "Notia" "QuQu" "RINDO" 
    "Rainy" "Rika" "Ruan" "Vivi" "Whisper" 
    "Wolferia" "Xinyan" "Yawl" "YuuYii" "Zwei"
)

# 语音ID映射（来自 character.md）
declare -A voice_ids=(
    ["Alice"]="rEJAAHKQqr6yTNCh8xS0"
    ["Ash"]="bY4cOgafbv5vatmokfg0"
    ["Bobo"]="I7CpaIqk2oGPGCKvOPO9"
    ["Elinyaa"]="4cxHntmhK38NT4QMBr9m"
    ["Fliza"]="s9lrHYk7TIJ2UO7UNbje"
    ["Imeris"]="eVItLK1UvXctxuaRV2Oq"
    ["Kyoko"]="ATSlMe1wEISLjgGhZEKK"
    ["Lena"]="uEn2ClE3OziJMlhQS91c"
    ["Lilium"]="yRRXNdbFeQpIK5MAhenr"
    ["Maple"]="B8gJV1IhpuegLxdpXFOE"
    ["Miru"]="eVJCDcwCTZBLNdQdbdmd"
    ["NEKONA"]="Ot15YZEOlkYfMhfPK4UGQ"
    ["Notia"]="9PzVGvNSS9b5P4fP2fDs"
    ["QuQu"]="1pEZe77mLmkQcvCjhQr2"
    ["RINDO"]="u7vJq3XhQ8N9gZ1fR5Yz"
    ["Rainy"]="nYwPw2dkP3hF8mVzQtBx"
    ["Rika"]="MbWU3Fx0wHXJMo6xKgPm"
    ["Ruan"]="aXaLNhMJNzUuBt35yTVJ"
    ["Vivi"]="EwHe5sSmN8BF8xYkwHkY"
    ["Whisper"]="tgNhK5YrHmV8cBmZvPqK"
    ["Wolferia"]="SdRnQaGhJx9wPmkXvUzF"
    ["Xinyan"]="VmKxLhGzR8cUqWpKgNjY"
    ["Yawl"]="NxVgMzRhS5fPqZbKjUwT"
    ["YuuYii"]="kJhQwMnFdN8RvBpKzXcG"
    ["Zwei"]="LzKgPrVhW3mJqRnFvBxT"
)

# 获取已生成的角色
completed_agents=("Alice" "Ash" "Bobo")

echo "✅ 已完成的角色配置: ${completed_agents[*]}"
echo "📋 待生成的角色配置:"

# 显示待生成列表
for char in "${characters[@]}"; do
    if [[ ! " ${completed_agents[*]} " =~ " ${char} " ]]; then
        echo "   - ${char,,}.json"
    fi
done

echo ""
echo "🔧 下一步操作:"
echo "1. 参考已生成的 alice.json, ash.json, bobo.json 模板"
echo "2. 根据 character.md 中的角色信息手动创建剩余配置"
echo "3. 或使用以下模板快速生成:"

# 生成模板示例
echo ""
echo "📄 Agent 配置模板 (character-template.json):"

cat > ./eliza/agents/character-template.json << 'EOF'
{
  "name": "{{CHARACTER_NAME}}",
  "bio": "{{CHARACTER_BIO}}",
  "lore": [
    "{{CHARACTER_NAME}} 生于{{BIRTHDAY}}，是{{ZODIAC}}",
    "{{PERSONALITY_TRAITS}}",
    "{{INTERESTS_AND_HOBBIES}}",
    "{{LIKES_AND_DISLIKES}}",
    "{{FAVORITE_THINGS}}"
  ],
  "messageExamples": [
    [
      {
        "user": "{{user1}}",
        "content": {
          "text": "示例用户消息"
        }
      },
      {
        "user": "{{CHARACTER_NAME}}",
        "content": {
          "text": "{{SAMPLE_RESPONSE}}"
        }
      }
    ]
  ],
  "postExamples": [
    "{{POST_EXAMPLE_1}}",
    "{{POST_EXAMPLE_2}}",
    "{{POST_EXAMPLE_3}}"
  ],
  "adjectives": [
    "{{TRAIT_1}}",
    "{{TRAIT_2}}",
    "{{TRAIT_3}}"
  ],
  "topics": [
    "{{TOPIC_1}}",
    "{{TOPIC_2}}",
    "{{TOPIC_3}}"
  ],
  "style": {
    "all": [
      "{{SPEAKING_STYLE_1}}",
      "{{SPEAKING_STYLE_2}}"
    ],
    "chat": [
      "{{CHAT_BEHAVIOR}}"
    ],
    "post": [
      "{{POST_BEHAVIOR}}"
    ]
  },
  "settings": {
    "voice": {
      "elevenlabs": {
        "voiceId": "{{VOICE_ID}}",
        "model": "eleven_multilingual_v2"
      }
    },
    "model": "anthropic:claude-3-haiku-20240307"
  }
}
EOF

echo ""
echo "🎯 快速使用方法:"
echo "1. 复制模板: cp ./eliza/agents/character-template.json ./eliza/agents/newcharacter.json"
echo "2. 替换模板变量: sed -i 's/{{CHARACTER_NAME}}/YourCharacter/g' ./eliza/agents/newcharacter.json"
echo "3. 手动完善细节信息"

echo ""
echo "📚 参考资源:"
echo "- character.md: 所有角色的详细信息"
echo "- alice.json: 活泼可爱型角色参考"
echo "- ash.json: 冷静理性型角色参考"
echo "- bobo.json: 温柔害羞型角色参考"

echo ""
echo "✨ 生成脚本完成！请根据需要手动创建剩余的角色配置文件。"