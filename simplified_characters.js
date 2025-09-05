// 简化的角色定义 - 只包含UI需要的信息
// Personality和AI特征由ElizaOS后端管理
const characters = [
    { id: "alice", name: "Alice", file: "Main VRM/Alice.vrm", voiceId: "rEJAAHKQqr6yTNCh8xS0", description: "活泼可爱的AI女友" },
    { id: "ash", name: "Ash", file: "Main VRM/Ash.vrm", voiceId: "bY4cOgafbv5vatmokfg0", description: "冷静理性的AI伙伴" },
    { id: "bobo", name: "Bobo", file: "Main VRM/Bobo.vrm", voiceId: "default", description: "温柔敏感的AI少女" },
    { id: "elinyaa", name: "Elinyaa", file: "Main VRM/Elinyaa.vrm", voiceId: "4cxHntmhK38NT4QMBr9m", description: "神秘优雅的精灵" },
    { id: "fliza", name: "Fliza", file: "Main VRM/Fliza VRM.vrm", voiceId: "s9lrHYk7TIJ2UO7UNbje", description: "温暖体贴的农家女" },
    { id: "imeris", name: "Imeris", file: "Main VRM/IMERIS.vrm", voiceId: "eVItLK1UvXctxuaRV2Oq", description: "高贵优雅的贵族" },
    { id: "kyoko", name: "Kyoko", file: "Main VRM/Kyoko.vrm", voiceId: "ATSlMe1wEISLjgGhZEKK", description: "独立自信的现代女性" },
    { id: "lena", name: "Lena", file: "Main VRM/Lena.vrm", voiceId: "uEn2ClE3OziJMlhQS91c", description: "优雅迷人的设计师" },
    { id: "lilium", name: "Lilium", file: "Main VRM/Lilium.vrm", voiceId: "yRRXNdbFeQpIK5MAhenr", description: "热情大胆的舞者" },
    { id: "maple", name: "Maple", file: "Main VRM/Maple.vrm", voiceId: "B8gJV1IhpuegLxdpXFOE", description: "温暖治愈的居家女孩" },
    { id: "miru", name: "Miru", file: "Main VRM/Miru.vrm", voiceId: "eVJCDcwCTZBLNdQdbdmd", description: "梦幻可爱的少女" },
    { id: "miumiu", name: "Miumiu", file: "Main VRM/Miumiu.vrm", voiceId: "SU7BtMmgc7KhQiC6G24B", description: "古怪创意的艺术家" },
    { id: "neco", name: "Neco", file: "Main VRM/Neco.vrm", voiceId: "t9ZwnJtpA3lWrJ4W7pAl", description: "冷静优雅的摄影师" },
    { id: "nekona", name: "Nekona", file: "Main VRM/NEKONA.vrm", voiceId: "kcg1KQQGuCGzH6FUjsZQ", description: "神秘慵懒的猫娘" },
    { id: "notia", name: "Notia", file: "Main VRM/Notia.vrm", voiceId: "abz2RylgxmJx76xNpaj1", description: "知性冷静的研究者" },
    { id: "ququ", name: "QuQu", file: "Main VRM/QuQu.vrm", voiceId: "tfQFvzjodQp63340jz2r", description: "活泼热情的冒险家" },
    { id: "rainy", name: "Rainy", file: "Main VRM/Rainy.vrm", voiceId: "1ghrzLZQ7Dza7Xs9OkhY", description: "宁静内敛的文青" },
    { id: "rindo", name: "Rindo", file: "Main VRM/RINDO.vrm", voiceId: "nclQ39ewSlJMu5Nidnsf", description: "坚毅果敢的武者" },
    { id: "sikirei", name: "Sikirei", file: "Main VRM/Sikirei.vrm", voiceId: "n263mAk9k8VWEuZSmuMl", description: "神秘魅力的占星师" },
    { id: "vivi", name: "Vivi", file: "Main VRM/Vivi.vrm", voiceId: "4lWJNy00PxQAOMgQTiIS", description: "开朗外向的主播" },
    { id: "wolf", name: "Wolf", file: "Main VRM/Wolf.vrm", voiceId: "WW3EvqkXGmu65ga8TYqa", description: "野性直觉的原始少女" },
    { id: "wolferia", name: "Wolferia", file: "Main VRM/Wolferia.vrm", voiceId: "3SeVwPUl5aO6J2GETjox", description: "自由冒险的狼族" },
    { id: "yawl", name: "Yawl", file: "Main VRM/Yawl.vrm", voiceId: "c6wjO0u66VyvwAC4UTqx", description: "优雅知性的学者" },
    { id: "yuuyii", name: "Yuuyii", file: "Main VRM/Yuuyii.vrm", voiceId: "UPwKM85l2CG7nbF2u1or", description: "甜美可爱的少女" },
    { id: "zwei", name: "Zwei", file: "Main VRM/Zwei.vrm", voiceId: "0EzDWfDZDlAIeQQOjhoC", description: "坚定忠诚的守护者" }
];