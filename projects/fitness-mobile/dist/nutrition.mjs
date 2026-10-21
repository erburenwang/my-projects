export const DIET = {
  "schemaVersion": 1,
  "basis": "以下每100g/ml数据是可编辑的菜单计算参考值，不是对某品牌包装标签的真实转录。购买后必须用实际标签覆盖；能量为kcal，中国标签如只给kJ则除以4.184。肉用包装可食净重，土豆/鲜果菜用烹调前可食部。",
  "food": [
    {
      "id": "oats",
      "name": "即食纯燕麦片",
      "unit": "g",
      "amount": 140,
      "kcal": 380,
      "p": 13,
      "f": 7,
      "c": 67,
      "storage": "干燥密封常温；选择可直接食用/即食款，临吃再加奶，不做常温隔夜燕麦。",
      "pack": {
        "size": 500,
        "unit": "g",
        "type": "袋",
        "note": "每周用980g；可买500g×2袋，剩余干燥密封留用。"
      }
    },
    {
      "id": "milk",
      "name": "全脂UHT常温纯牛奶",
      "unit": "ml",
      "amount": 500,
      "kcal": 64,
      "p": 3.2,
      "f": 3.6,
      "c": 4.7,
      "storage": "包装须明确未开封可常温保存；250ml一盒，开一盒当餐喝完，不留半盒。巴氏鲜奶/冷藏奶不适用。",
      "pack": {
        "size": 250,
        "unit": "ml",
        "type": "盒",
        "dailyCount": 2
      }
    },
    {
      "id": "apple",
      "name": "完整苹果（可食部）",
      "unit": "g",
      "amount": 200,
      "kcal": 52,
      "p": 0.3,
      "f": 0.2,
      "c": 14,
      "storage": "买完整无破损果，吃前洗；不预切几天。软烂发霉丢弃。",
      "pack": {
        "size": 200,
        "unit": "g",
        "type": "个可食部约",
        "dailyCount": 1,
        "note": "200g可食部约需220g整果，实际大小以称重为准。"
      }
    },
    {
      "id": "chicken",
      "name": "可常温保存的即食鸡胸肉",
      "unit": "g",
      "amount": 400,
      "kcal": 125,
      "p": 25,
      "f": 2,
      "c": 1.75,
      "storage": "仅使用包装明确标注未开封可常温保存、且在标示温度与保质期内的商业灭菌产品；真空/即食字样本身不代表可常温。100g一小包，每餐现开2包吃完。冷藏即食鸡胸、生鸡胸和裸露熟鸡胸不能替代常温库存。",
      "pack": {
        "size": 100,
        "unit": "g",
        "type": "包",
        "dailyCount": 4
      }
    },
    {
      "id": "potato",
      "name": "土豆（烹调前可食部）",
      "unit": "g",
      "amount": 800,
      "kcal": 77,
      "p": 2,
      "f": 0.1,
      "c": 17,
      "storage": "买完整土豆，阴凉干燥避光通风；吃前才清洗切丁。发绿、腐烂或明显发芽不用。切开和煮熟后不跨餐常温存。",
      "pack": {
        "size": null,
        "unit": "g",
        "type": "散称",
        "note": "采购毛重比可食部约多10%–15%，下表按3.6kg/2.7kg留损耗。"
      }
    },
    {
      "id": "tomato",
      "name": "完整鲜番茄（可食部）",
      "unit": "g",
      "amount": 400,
      "kcal": 20,
      "p": 1,
      "f": 0.2,
      "c": 3.5,
      "storage": "完整未切、无破损，阴凉通风避晒；分买成熟和稍硬的果，熟的先吃。4天是采购节奏，不是安全保质承诺；闷热/无合适存放点时改用下述单餐番茄罐头，不买鲜果囤4天。",
      "pack": {
        "size": null,
        "unit": "g",
        "type": "散称",
        "note": "每餐约200g，吃前洗切，不提前切半存放。"
      }
    },
    {
      "id": "oil",
      "name": "食用植物油",
      "unit": "g",
      "amount": 37,
      "kcal": 900,
      "p": 0,
      "f": 100,
      "c": 0,
      "storage": "按标签阴凉避光密封，称重用量；每天37g分午餐18g、晚餐19g。",
      "pack": {
        "size": null,
        "unit": "g",
        "type": "瓶内称取",
        "note": "每周259g；按库存买小瓶，不必每次重复买。"
      }
    }
  ],
  "meals": [
    {
      "id": "first",
      "title": "便携首餐",
      "timeKey": "10:30",
      "items": [
        {
          "food": "oats",
          "amount": 100
        },
        {
          "food": "milk",
          "amount": 250
        },
        {
          "food": "apple",
          "amount": 200
        }
      ],
      "instructions": "燕麦提前称好干装带走，牛奶保持未开封；10:30再开奶，按燕麦包装可冷泡/即食的方式拌好即吃。奶不提前拌入燕麦放一上午；整苹果随餐吃。",
      "referenceTotal": {
        "kcal": 644,
        "p": 21.6,
        "f": 16.4,
        "c": 106.75
      }
    },
    {
      "id": "lunch",
      "title": "土豆番茄配鸡胸",
      "timeKey": "13:30",
      "items": [
        {
          "food": "chicken",
          "amount": 200
        },
        {
          "food": "potato",
          "amount": 400
        },
        {
          "food": "tomato",
          "amount": 200
        },
        {
          "food": "oil",
          "amount": 18
        }
      ],
      "instructions": "土豆切约1cm丁，分量只做这一餐，煮至熟透约10–15分钟，末段加番茄；鸡胸为可即食熟制品，现开即吃或按包装说明加热，吃时加18g油。小锅容量不足时土豆分两批煮，或先盛出土豆再煮番茄、加热鸡胸；不要强塞一锅。容量与功率合适时约15–20分钟，需分批时可能更久。勿把未标明可水煮的塑料包装直接下锅。",
      "referenceTotal": {
        "kcal": 760,
        "p": 60,
        "f": 22.8,
        "c": 78.5
      }
    },
    {
      "id": "snack",
      "title": "燕麦与奶加餐",
      "timeKey": "16:30",
      "items": [
        {
          "food": "oats",
          "amount": 40
        },
        {
          "food": "milk",
          "amount": 250
        }
      ],
      "instructions": "干燕麦40g与未开封250ml常温奶分开携带，当次开奶拌好吃完，可按课程/训练安排前后移动。",
      "referenceTotal": {
        "kcal": 312,
        "p": 13.2,
        "f": 11.8,
        "c": 38.55
      }
    },
    {
      "id": "dinner",
      "title": "同款晚餐",
      "timeKey": "19:00",
      "items": [
        {
          "food": "chicken",
          "amount": 200
        },
        {
          "food": "potato",
          "amount": 400
        },
        {
          "food": "tomato",
          "amount": 200
        },
        {
          "food": "oil",
          "amount": 19
        }
      ],
      "instructions": "做法同午餐，油19g。每次只做一餐，不把午餐煮好的土豆、菜或开封鸡肉留至晚餐。",
      "referenceTotal": {
        "kcal": 769,
        "p": 60,
        "f": 23.8,
        "c": 78.5
      }
    }
  ],
  "referenceTotal": {
    "kcal": 2485,
    "p": 154.8,
    "f": 74.8,
    "c": 302.3
  },
  "shopping": [
    {
      "food": "oats",
      "monday": {
        "amount": 560,
        "unit": "g"
      },
      "friday": {
        "amount": 420,
        "unit": "g"
      },
      "note": "500g×2袋可覆盖一周980g用量，按库存补货。"
    },
    {
      "food": "milk",
      "monday": {
        "amount": 2000,
        "unit": "ml",
        "count": 8,
        "pack": "250ml/盒"
      },
      "friday": {
        "amount": 1500,
        "unit": "ml",
        "count": 6,
        "pack": "250ml/盒"
      }
    },
    {
      "food": "apple",
      "monday": {
        "amount": 800,
        "unit": "g可食部",
        "purchaseApprox": 880,
        "approxCount": 4
      },
      "friday": {
        "amount": 600,
        "unit": "g可食部",
        "purchaseApprox": 660,
        "approxCount": 3
      },
      "note": "整果每个约220g只是估计，按可食部称重。"
    },
    {
      "food": "chicken",
      "monday": {
        "amount": 1600,
        "unit": "g",
        "count": 16,
        "pack": "100g/包"
      },
      "friday": {
        "amount": 1200,
        "unit": "g",
        "count": 12,
        "pack": "100g/包"
      }
    },
    {
      "food": "potato",
      "monday": {
        "amount": 3200,
        "unit": "g可食部",
        "purchaseApprox": 3600
      },
      "friday": {
        "amount": 2400,
        "unit": "g可食部",
        "purchaseApprox": 2700
      },
      "note": "约多买10%–15%留清理损耗；不提前洗切。"
    },
    {
      "food": "tomato",
      "monday": {
        "amount": 1400,
        "unit": "g可食部",
        "purchaseApprox": 1450
      },
      "friday": {
        "amount": 1000,
        "unit": "g可食部",
        "purchaseApprox": 1050
      },
      "note": "已扣除周一和周五晚餐各200g番茄，改为采购日当天西兰花100g＋胡萝卜100g；西兰花/胡萝卜额外采购见rotation.shopping。鲜番茄只在有合适存放条件时使用，闷热改为常温单餐罐头。"
    },
    {
      "food": "oil",
      "monday": {
        "amount": 148,
        "unit": "g"
      },
      "friday": {
        "amount": 111,
        "unit": "g"
      },
      "note": "从已购小瓶称取；一周259g，按库存补货，不要求分装成开口小杯。"
    },
    {
      "food": "broccoli",
      "name": "西兰花",
      "monday": {
        "amount": 100,
        "unit": "g可食部",
        "purchaseApprox": 150
      },
      "friday": {
        "amount": 100,
        "unit": "g可食部",
        "purchaseApprox": 150
      },
      "note": "仅周一、周五采购日当天晚餐轮换用，不按每天100g囤货。毛重只作估计；实际小包装或整颗可食部分更多时，当晚分批煮完吃完，并按实际克数记录。"
    },
    {
      "food": "carrot",
      "name": "胡萝卜",
      "monday": {
        "amount": 100,
        "unit": "g可食部",
        "purchaseApprox": 120
      },
      "friday": {
        "amount": 100,
        "unit": "g可食部",
        "purchaseApprox": 120
      },
      "note": "仅周一、周五采购日当天晚餐轮换用，不按每天100g囤货。毛重只作估计；实际小包装或整颗可食部分更多时，当晚分批煮完吃完，并按实际克数记录。"
    }
  ],
  "shoppingRule": "默认周一采购覆盖周一至周四4天；周五采购覆盖周五至周日3天。基础食物按日量乘4/3，番茄按rotation在各批次减200g，采购日另买当天西兰花和胡萝卜。显示的是用量，不把计划当已吃达成。",
  "tomatoHotWeatherAlternative": {
    "name": "无油原味番茄罐头/常温灭菌袋装番茄（非番茄沙司）",
    "selection": "优先单餐装，包装明确可常温保存；每餐整罐固形物/沥干菜重至少200g，开一罐当餐吃完；不能把大罐开封后分两餐放。",
    "examplePack": "若买净重400g、固形物240g/罐：每餐1整罐，把全部240g番茄固形物吃完；汁按需要当餐使用或丢弃，不能留存。",
    "daily": {
      "count": 2,
      "packNetWeightG": 400,
      "edibleSolidsG": 480,
      "note": "适用于其他5个基础日；周一/周五晚餐按蔬菜轮换，当日仅午餐需1罐。"
    },
    "monday": {
      "count": 7,
      "packNetWeightG": 2800,
      "edibleSolidsG": 1680
    },
    "friday": {
      "count": 5,
      "packNetWeightG": 2000,
      "edibleSolidsG": 1200
    },
    "nutritionNote": "网页实际录入以沥干固形物和对应营养口径为准；罐头每100g值不可不经核对直接套鲜番茄。若标签仅给整罐含汁每100g，选择整罐含汁食用并按400g/餐记录，或另找有沥干口径标签的产品。罐头替换会改变当天估算，通常无须为几十大卡删奶。"
  },
  "freshVegetableOptional": "已作为默认轮换：周一和周五晚餐，用西兰花100g＋胡萝卜100g替换基础番茄200g；采购日当天买当天水煮分步吃完，不预切多日保存。基础营养与轮换营养分别见referenceTotal与rotation.referenceDayTotal。",
  "chickenFallback": {
    "primary": "常温鸡肉罐头/商业灭菌鸡肉软袋（不要求必须胸肉，但包装必须允许未开封常温），单餐整包/整罐可食鸡肉200g，每天400g；周一1600g可食鸡肉，周五1200g。若某罐标净重300g、沥干肉重200g，则每天2罐，周一8罐/总净重2400g，周五6罐/总净重1800g。把鱼/鸡罐汁和可食肉重分清。",
    "nutrition": "鸡肉罐头的脂肪、钠和蛋白可能与鸡胸差很多；按实际营养标签重算，不把400g罐头净重误算400g鸡肉。选低盐/原味；未拿到标签前不承诺等热量、等蛋白。"
  },
  "safety": [
    "首选阴凉干燥、避阳光热源处；包装标温度、保质期、是否需冷藏优先。宿舍闷热超过产品标温时，不能靠“常温”二字继续囤货。",
    "常温即食鸡胸和奶均只在未开封且合规储存时可常温；真空包装、健身即食、铝膜袋、长保质期都不是独立安全依据。",
    "每次开一餐，立即吃完。无冰箱不留午餐熟土豆/熟菜/开封鸡肉到晚上；不能靠二次煮开恢复已经不安全的食物。",
    "需冷藏的易腐食品室温累计超过2小时（高于约32°C时超过1小时）丢弃；时间包括携带、备餐和进食，不把该上限当成可常温存几天。",
    "不买鼓包、渗漏、封口破损的食品；发霉软烂蔬果不用。闻起来正常不能证明安全。",
    "便携首餐把干燕麦、整果、未开封奶分开带；不在早上就把奶拌燕麦后无冷藏带到10:30。"
  ],
  "sources": [
    {
      "id": "FDA-storage",
      "title": "FDA: Are You Storing Food Safely?",
      "url": "https://www.fda.gov/consumers/consumer-updates/are-you-storing-food-safely",
      "supports": "需要冷藏的食品室温不超过2小时；环境超过约32°C时不超过1小时；按标签储存，病原菌不能靠闻味排除。"
    },
    {
      "id": "USDA-shelf",
      "title": "USDA FSIS: Shelf-Stable Food Safety",
      "url": "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/shelf-stable-food",
      "supports": "只有经过合适加工、包装的常温食品才能常温存；冷藏标签优先；商业灭菌软袋可含鸡胸；开封肉类须冷藏，不能用未开封保质期替代开封管理。"
    },
    {
      "id": "FDA-UHT",
      "title": "FDA: Investigating Food Safety from Farm to Table, UHT milk",
      "url": "https://www.fda.gov/downloads/food/foodscienceresearch/toolsmaterials/ucm430366.pdf",
      "supports": "无菌包装UHT奶未开封可常温；开封后应像普通奶一样冷藏，本方案用250ml单盒一次喝完。"
    },
    {
      "id": "UMD-produce",
      "title": "University of Maryland Extension: Storing Garden Fruits and Vegetables",
      "url": "https://extension.umd.edu/resource/storing-garden-fruits-and-vegetables",
      "supports": "整番茄可室温储存，土豆适合阴凉干燥避光通风处；胡萝卜和西兰花表列冷藏；切开的蔬果需冷藏；储藏期随条件变化，霉变腐烂丢弃。"
    }
  ],
  "rotation": {
    "id": "purchase-day-dinner-vegetables",
    "description": "默认周一、周五晚餐用采购当天买当天吃的西兰花100g＋胡萝卜100g，替换基础菜单的番茄200g；其余5天保持基础菜单。food[].amount仍表示基础日量，实际日菜单与采购按此轮换覆盖。",
    "days": [
      1,
      5
    ],
    "daysConvention": "1=周一，5=周五",
    "mealId": "dinner",
    "remove": [
      {
        "food": "tomato",
        "amount": 200
      }
    ],
    "add": [
      {
        "food": "broccoli",
        "amount": 100
      },
      {
        "food": "carrot",
        "amount": 100
      }
    ],
    "delta": {
      "kcal": 35,
      "p": 1.7,
      "f": 0.2,
      "c": 9.2
    },
    "referenceDayTotal": {
      "kcal": 2520,
      "p": 156.5,
      "f": 75,
      "c": 311.5
    },
    "referenceDinnerTotal": {
      "kcal": 804,
      "p": 61.7,
      "f": 24,
      "c": 87.7
    },
    "shopping": {
      "monday": {
        "tomatoEdibleG": 1400,
        "broccoliEdibleG": 100,
        "carrotEdibleG": 100,
        "broccoliPurchaseApproxG": 150,
        "carrotPurchaseApproxG": 120
      },
      "friday": {
        "tomatoEdibleG": 1000,
        "broccoliEdibleG": 100,
        "carrotEdibleG": 100,
        "broccoliPurchaseApproxG": 150,
        "carrotPurchaseApproxG": 120
      },
      "note": "鲜番茄一周2400g净；西兰花和胡萝卜各200g净/周。毛重只是留处理损耗的估计，若买的小包装更多，采购当天分批全部煮食并按实际克数记录，不能把多余鲜切菜存几天。 若西兰花只能买整颗，采购当天晚餐把整颗可食部分煮完吃完并按实际可食克数记录，不把半颗留多日；100g净仅是计划核算起点。"
    },
    "cooking": "只用一个小煮锅分步水煮：先把本餐土豆丁煮熟盛出；再煮胡萝卜薄片约4–6分钟，加入西兰花小朵再煮约3–5分钟至适口熟透；即食鸡胸现开即吃或按包装要求另行加热。锅小时继续分批，不强塞一锅。总时间随锅容量、功率和分批次数变化，不承诺任何小锅均在20分钟内完成。",
    "hotWeather": "采购日买好后尽快做完吃完，不在热宿舍存到隔日；非采购日无合适鲜番茄存放条件时用单餐常温番茄罐头。",
    "weeklyReferenceAverage": {
      "kcal": 2495,
      "p": 155.29,
      "f": 74.86,
      "c": 304.93
    },
    "foods": [
      {
        "id": "broccoli",
        "name": "西兰花（烹调前可食部）",
        "unit": "g",
        "amount": 100,
        "kcal": 34,
        "p": 2.8,
        "f": 0.4,
        "c": 6.6,
        "storage": "仅采购日当天做完吃完，不作无冰箱多日库存。"
      },
      {
        "id": "carrot",
        "name": "胡萝卜（烹调前可食部）",
        "unit": "g",
        "amount": 100,
        "kcal": 41,
        "p": 0.9,
        "f": 0.2,
        "c": 9.6,
        "storage": "仅采购日当天做完吃完，不预切多日保存。"
      }
    ]
  }
};
