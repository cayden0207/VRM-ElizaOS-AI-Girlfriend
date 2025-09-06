// 国际化配置文件
class I18n {
    constructor() {
        // Check if user has existing language preference
        const existingLang = localStorage.getItem('language');
        
        // Only force English if no preference exists (first visit)
        if (!existingLang) {
            this.currentLang = 'en';
            localStorage.setItem('language', 'en');
        } else {
            // Respect user's language choice
            this.currentLang = existingLang;
        }
        
        this.init();
        // Merge auto-generated character i18n if present
        if (typeof window !== 'undefined' && window.I18N_CHARACTERS) {
            const gen = window.I18N_CHARACTERS;
            if (gen.en) Object.assign(this.texts.en, gen.en);
            if (gen.zh) Object.assign(this.texts.zh, gen.zh);
        }
    }

    texts = {
        en: {
            // Page titles
            'app.title': 'AI Girlfriend Chat Game 🌸',
            'char.select.title': 'WAIFU - Choose Your Girlfriend',
            
            // Character selection page
            'char.select.header': 'WAIFU',
            'char.select.start': 'START',
            'char.select.voice.sample': 'Sample Voice',
            'char.select.language': 'Language: ',
            'char.select.loading': 'Loading character...',
            
            // Chat interface
            'chat.input.placeholder': 'Type your message here...',
            'chat.send': 'Send',
            'chat.voice.play': '🎵 Play Voice',
            'chat.connecting': 'Connecting...',
            'chat.loading': 'Loading...',
            
            // Buttons and controls
            'btn.back': 'Back',
            'btn.retry': 'Retry',
            'btn.refresh': 'Refresh',
            
            // Character descriptions
            'char.alice.desc': 'Lively and cute AI girlfriend',
            'char.ash.desc': 'Calm and rational AI companion',
            'char.bobo.desc': 'Gentle and sensitive AI girl',
            'char.elinyaa.desc': 'Mysterious and elegant elf',
            'char.fliza.desc': 'Warm and caring farm girl',
            'char.imeris.desc': 'Noble and elegant aristocrat',
            'char.kyoko.desc': 'Independent and confident modern woman',
            'char.lena.desc': 'Elegant and charming designer',
            'char.lilium.desc': 'Passionate and bold dancer',
            'char.maple.desc': 'Warm and healing homebody',
            'char.miru.desc': 'Dreamy and cute girl',
            'char.miumiu.desc': 'Quirky creative artist',
            'char.neco.desc': 'Cool and elegant photographer',
            'char.nekona.desc': 'Mysterious and lazy cat girl',
            'char.notia.desc': 'Intellectual and calm researcher',
            'char.ququ.desc': 'Lively and passionate adventurer',
            'char.rainy.desc': 'Quiet and introverted literary girl',
            'char.rindo.desc': 'Resolute and determined warrior',
            'char.sikirei.desc': 'Mysterious and charming astrologer',
            'char.vivi.desc': 'Cheerful and outgoing streamer',
            'char.wolf.desc': 'Wild and instinctive primitive girl',
            'char.wolferia.desc': 'Free-spirited wolf clan adventurer',
            'char.yawl.desc': 'Elegant and intellectual scholar',
            'char.yuuyii.desc': 'Sweet and lovely girl',
            'char.zwei.desc': 'Steadfast and loyal guardian',
            
            // Error messages
            'error.network': 'Network connection failed, please refresh the page',
            'error.save': 'Save failed, please try again',
            'error.delete': 'Delete failed, please try again',
            'error.load': 'Load failed, please refresh the page',
            'error.wallet.required': 'Please connect your wallet first to start chatting!',
            
            // Language options
            'lang.english': 'English',
            'lang.chinese': '中文',

            // Control panel
            'panel.character.select': 'Character Selection',
            'panel.select.character': 'Select character...',
            'panel.animation.test': 'Animation Test', 
            'panel.select.animation': 'Select animation...',
            'panel.play.animation': 'Play Animation',

            // Status indicators
            'status.vrm': 'VRM Status: ',
            'status.loading': 'Loading...',
            'status.current.animation': 'Current Animation: ',
            'status.none': 'None',
            'status.expression': 'Expression Status: ',
            'status.neutral': 'Neutral',
            'status.auto.blink': 'Auto Blink: ',
            'status.enabled': 'Enabled',
            'status.disabled': 'Disabled',
            'status.ai.smart': 'AI Smart Mode',
            'status.manual': 'Manual Mode',

            // Wallet verification modal
            'wallet.verification.title': '🔒 Wallet Verification Required',
            'wallet.verification.message': 'Please connect your Solana wallet first to access the AI girlfriend chat room. Each wallet address will get a unique personalized experience!',
            'wallet.verification.button': 'Back to Connect Wallet',
            
            // ElizaOS messages
            'eliza.thinking': 'AI is thinking...',
            'eliza.initializing': 'Initializing ElizaOS chat system...',
            'eliza.init.complete': 'ElizaOS chat system initialized successfully',
            'eliza.init.failed': 'ElizaOS system initialization failed',
            'eliza.connection.failed': 'ElizaOS API connection failed',
            'eliza.connection.normal': 'ElizaOS connection is normal',
            'eliza.send.failed': 'Message sending failed',

            // Character profile
            'profile.header': 'Basic Info',
            'profile.age': 'Age',
            'profile.birthday': 'Birthday',
            'profile.zodiac': 'Zodiac',
            'profile.personality': 'Personality',
            'profile.interests': 'Interests',
            'profile.likes': 'Likes',
            'profile.dislikes': 'Dislikes',
            'profile.food': 'Favorite Food',
            'profile.music': 'Music',
            'profile.movies': 'Movies',

            // Profile section headers
            'profile.likes.dislikes': 'Likes & Dislikes',
            'profile.favorites': 'Favorites',
            
            // Profile field labels
            'profile.personality': 'Personality',
            'profile.interests': 'Daily Interests',
            'profile.personality.value': 'Lively, outgoing, playful and cute',
            'profile.interests.value': 'Dancing, singing',
            'profile.likes.label': 'Likes',
            'profile.dislikes.label': 'Dislikes', 
            'profile.food.label': 'Food',
            'profile.music.label': 'Music',
            'profile.movies.label': 'Movies',
            'profile.games.label': 'Games',
            
            // Character profiles
            'character.alice.age': '22',
            'character.alice.birthday': 'June 5',
            'character.alice.zodiac': 'Gemini',
            'character.alice.personality': 'Lively, outgoing, playful and cute',
            'character.alice.interests': 'Dancing, singing',
            'character.alice.likes': 'Flowers and colorful sweets',
            'character.alice.dislikes': 'Quiet and overly serious occasions',
            'character.alice.food': 'Strawberry cake, macarons',
            'character.alice.music': 'Pop dance music, K-Pop',
            'character.alice.movies': 'Romantic comedies',
            'character.alice.games': 'Rhythm dance games',

            // Character: Rainy (example full set)
            'character.rainy.age': '21',
            'character.rainy.birthday': 'November 5',
            'character.rainy.zodiac': 'Scorpio',
            'character.rainy.personality': 'Quiet, gentle, and introspective',
            'character.rainy.interests': 'Walking in the rain',
            'character.rainy.likes': 'Sound of rain',
            'character.rainy.dislikes': 'Hot sunny days',
            'character.rainy.food': 'Ramen, hot chocolate',
            'character.rainy.music': 'Slow-tempo jazz',
            'character.rainy.movies': 'Art and indie films',
            'character.rainy.games': 'Interactive novels',

            // Character: Sikirei (example full set)
            'character.sikirei.age': '24',
            'character.sikirei.birthday': 'October 10',
            'character.sikirei.zodiac': 'Libra',
            'character.sikirei.personality': 'Alluring, mysterious, and refined',
            'character.sikirei.interests': 'Astrology research',
            'character.sikirei.likes': 'Stars and night sky',
            'character.sikirei.dislikes': 'Light pollution',
            'character.sikirei.food': 'Blueberry pudding, herbal tea',
            'character.sikirei.music': 'Ambient soundscapes',
            'character.sikirei.movies': 'Sci-fi mysteries',
            'character.sikirei.games': 'The Sims',

            // User registration form
            'registration.title': 'User Registration',
            'registration.edit.title': 'Edit Profile',
            'registration.username': 'Username',
            'registration.username.placeholder': 'Maximum 12 characters',
            'registration.username.note': 'Other users can see this (maximum 12 characters)',
            'registration.display.name': 'Your Name',
            'registration.display.name.placeholder': 'Name',
            'registration.display.name.note': '"Your Name" is what the AI girlfriend will call you in chat, not visible to other users<br>"Username" and "Your Name" can be modified later in personal profile.',
            'registration.birthday': 'Your Birthday',
            'registration.birthday.year': 'Year',
            'registration.birthday.month': 'Month',
            'registration.birthday.day': 'Day',
            'registration.birthday.note': '※Birthday cannot be changed after setting',
            'registration.location': 'Location',
            'registration.location.placeholder': 'e.g.: Beijing, Shanghai, New York',
            'registration.language': 'Language Setting',
            'registration.language.select': 'Select Language',
            'registration.preferences': 'Personal Preference Memory',
            'registration.favorite.food': 'Favorite Food',
            'registration.favorite.food.placeholder': 'e.g.: Hot pot, pasta, sushi',
            'registration.favorite.color': 'Favorite Color',
            'registration.favorite.color.placeholder': 'e.g.: Blue, pink, green',
            'registration.hobbies': 'Hobbies',
            'registration.hobbies.placeholder': 'e.g.: Reading, listening to music, gaming',
            'registration.submit': 'OK',

            // Success and action messages
            'registration.success': '🎉 Registration Complete! Please choose your AI girlfriend character',
            'wallet.disconnected': 'Wallet disconnected',

            // Status messages
            'status.online': 'Online'
        },
        
        zh: {
            // Page titles
            'app.title': 'AI女友聊天游戏 🌸',
            'char.select.title': 'WAIFU - 选择你的女友角色',
            
            // Character selection page
            'char.select.header': 'WAIFU',
            'char.select.start': '开始',
            'char.select.voice.sample': '试听语音',
            'char.select.language': '语言: ',
            'char.select.loading': '加载角色中...',
            
            // Chat interface
            'chat.input.placeholder': '在此输入你的消息...',
            'chat.send': '发送',
            'chat.voice.play': '🎵 播放语音',
            'chat.connecting': '连接中...',
            'chat.loading': '加载中...',
            
            // Buttons and controls
            'btn.back': '返回',
            'btn.retry': '重试',
            'btn.refresh': '刷新',
            
            // Character descriptions
            'char.alice.desc': '活泼可爱的AI女友',
            'char.ash.desc': '冷静理性的AI伙伴',
            'char.bobo.desc': '温柔敏感的AI少女',
            'char.elinyaa.desc': '神秘优雅的精灵',
            'char.fliza.desc': '温暖体贴的农家女',
            'char.imeris.desc': '高贵优雅的贵族',
            'char.kyoko.desc': '独立自信的现代女性',
            'char.lena.desc': '优雅迷人的设计师',
            'char.lilium.desc': '热情大胆的舞者',
            'char.maple.desc': '温暖治愈的居家女孩',
            'char.miru.desc': '梦幻可爱的少女',
            'char.miumiu.desc': '古怪创意的艺术家',
            'char.neco.desc': '冷静优雅的摄影师',
            'char.nekona.desc': '神秘慵懒的猫娘',
            'char.notia.desc': '知性冷静的研究者',
            'char.ququ.desc': '活泼热情的冒险家',
            'char.rainy.desc': '宁静内敛的文青',
            'char.rindo.desc': '坚毅果敢的武者',
            'char.sikirei.desc': '神秘魅力的占星师',
            'char.vivi.desc': '开朗外向的主播',
            'char.wolf.desc': '野性直觉的原始少女',
            'char.wolferia.desc': '自由冒险的狼族',
            'char.yawl.desc': '优雅知性的学者',
            'char.yuuyii.desc': '甜美可爱的少女',
            'char.zwei.desc': '坚定忠诚的守护者',
            
            // Error messages
            'error.network': '网络连接失败，请检查网络后刷新页面',
            'error.save': '保存失败，请重试',
            'error.delete': '删除失败，请重试',
            'error.load': '加载失败，请刷新页面',
            'error.wallet.required': '请先连接钱包后再开始聊天！',
            
            // Language options
            'lang.english': 'English',
            'lang.chinese': '中文',

            // Control panel
            'panel.character.select': '角色选择',
            'panel.select.character': '选择角色...',
            'panel.animation.test': '动画测试', 
            'panel.select.animation': '选择动画...',
            'panel.play.animation': '播放动画',

            // Status indicators
            'status.vrm': 'VRM状态: ',
            'status.loading': '加载中...',
            'status.current.animation': '当前动画: ',
            'status.none': '无',
            'status.expression': '表情状态: ',
            'status.neutral': '中性',
            'status.auto.blink': '自动眨眼: ',
            'status.enabled': '开启',
            'status.disabled': '关闭',
            'status.ai.smart': 'AI智能模式',
            'status.manual': '手动模式',

            // Wallet verification modal
            'wallet.verification.title': '🔒 需要钱包验证',
            'wallet.verification.message': '请先连接您的Solana钱包才能访问AI女友聊天室。每个钱包地址都会获得独特的个性化体验！',
            'wallet.verification.button': '返回连接钱包',
            
            // ElizaOS messages
            'eliza.thinking': 'AI正在思考...',
            'eliza.initializing': '初始化ElizaOS聊天系统...',
            'eliza.init.complete': 'ElizaOS聊天系统初始化完成',
            'eliza.init.failed': 'ElizaOS系统初始化失败',
            'eliza.connection.failed': 'ElizaOS API连接失败',
            'eliza.connection.normal': 'ElizaOS连接正常',
            'eliza.send.failed': '发送消息失败',

            // Character profile
            'profile.header': '基本信息',
            'profile.age': '年龄',
            'profile.birthday': '诞生日',
            'profile.zodiac': '星座',
            'profile.personality': '性格',
            'profile.interests': '兴趣',
            'profile.likes': '喜欢',
            'profile.dislikes': '不喜欢',
            'profile.food': '喜欢的食物',
            'profile.music': '音乐',
            'profile.movies': '电影',

            // Profile section headers
            'profile.likes.dislikes': '喜好 & 讨厌',
            'profile.favorites': '最爱',
            
            // Profile field labels
            'profile.personality.value': '活泼外向，调皮可爱',
            'profile.interests.value': '跳舞、唱歌',
            'profile.likes.label': '喜欢',
            'profile.dislikes.label': '讨厌', 
            'profile.food.label': '食物',
            'profile.music.label': '音乐',
            'profile.movies.label': '电影',
            'profile.games.label': '游戏',
            
            // Character profiles
            'character.alice.age': '22',
            'character.alice.birthday': '6月5日',
            'character.alice.zodiac': '双子座',
            'character.alice.personality': '活泼外向，调皮可爱',
            'character.alice.interests': '跳舞、唱歌',
            'character.alice.likes': '鲜花和彩色甜点',
            'character.alice.dislikes': '安静和过于严肃的场合',
            'character.alice.food': '草莓蛋糕、马卡龙',
            'character.alice.music': '流行舞曲、K-Pop',
            'character.alice.movies': '浪漫喜剧',
            'character.alice.games': '节奏舞蹈游戏',

            // Character: Rainy（示例完整配置）
            'character.rainy.age': '21',
            'character.rainy.birthday': '11月5日',
            'character.rainy.zodiac': '天蝎座',
            'character.rainy.personality': '安静、温柔、内省',
            'character.rainy.interests': '雨中漫步',
            'character.rainy.likes': '雨声',
            'character.rainy.dislikes': '炎热晴天',
            'character.rainy.food': '拉面、热巧克力',
            'character.rainy.music': '慢节奏爵士',
            'character.rainy.movies': '艺术与独立电影',
            'character.rainy.games': '互动小说',

            // Character: Sikirei（示例完整配置）
            'character.sikirei.age': '24',
            'character.sikirei.birthday': '10月10日',
            'character.sikirei.zodiac': '天秤座',
            'character.sikirei.personality': '诱人、神秘、优雅',
            'character.sikirei.interests': '占星研究',
            'character.sikirei.likes': '星星和夜空',
            'character.sikirei.dislikes': '光污染',
            'character.sikirei.food': '蓝莓布丁、花草茶',
            'character.sikirei.music': '氛围音景',
            'character.sikirei.movies': '科幻悬疑',
            'character.sikirei.games': '模拟人生',

            // User registration form
            'registration.title': '用户注册',
            'registration.edit.title': '编辑资料',
            'registration.username': '用户名',
            'registration.username.placeholder': '最多12个字符',
            'registration.username.note': '其他用户可以看到（最多12个字符）',
            'registration.display.name': '你的名字',
            'registration.display.name.placeholder': '姓名',
            'registration.display.name.note': '「你的名字」是AI女友在聊天中称呼你的名字，对其他用户不可见<br>「用户名」和「你的名字」以后可以在个人资料中修改。',
            'registration.birthday': '你的生日',
            'registration.birthday.year': '年',
            'registration.birthday.month': '月',
            'registration.birthday.day': '日',
            'registration.birthday.note': '※生日设置后无法更改',
            'registration.location': '居住地',
            'registration.location.placeholder': '例：北京、上海、纽约',
            'registration.language': '语言设置',
            'registration.language.select': '选择语言',
            'registration.preferences': '个人偏好记忆',
            'registration.favorite.food': '喜欢的食物',
            'registration.favorite.food.placeholder': '例：火锅、意面、寿司',
            'registration.favorite.color': '喜欢的颜色',
            'registration.favorite.color.placeholder': '例：蓝色、粉色、绿色',
            'registration.hobbies': '兴趣爱好',
            'registration.hobbies.placeholder': '例：读书、听音乐、游戏',
            'registration.submit': 'OK',

            // Success and action messages
            'registration.success': '🎉 注册完成！请选择你的AI女友角色',
            'wallet.disconnected': '钱包已断开连接',

            // Status messages
            'status.online': '在线'
        }
    };

    init() {
        // 设置HTML lang属性
        document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : 'en';
    }

    // 获取翻译文本
    t(key) {
        return this.texts[this.currentLang][key] || this.texts['en'][key] || key;
    }

    // 切换语言
    switchLanguage(lang) {
        if (lang === this.currentLang) return;
        
        this.currentLang = lang;
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        
        // 触发语言切换事件
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
        
        // 刷新页面以应用新语言
        location.reload();
    }

    // 获取当前语言
    getCurrentLanguage() {
        return this.currentLang;
    }

    // 检测浏览器语言（可选）
    detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        return browserLang.startsWith('zh') ? 'zh' : 'en';
    }
}

// 创建全局实例
const i18n = new I18n();

// 页面加载完成后初始化翻译
document.addEventListener('DOMContentLoaded', function() {
    // 翻译所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = i18n.t(key);
    });

    // 翻译所有带有 data-i18n-placeholder 属性的元素
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = i18n.t(key);
    });

    // 翻译页面标题
    if (document.querySelector('[data-i18n-title]')) {
        const key = document.querySelector('[data-i18n-title]').getAttribute('data-i18n-title');
        document.title = i18n.t(key);
    }
});

// 导出给其他脚本使用
window.i18n = i18n;
