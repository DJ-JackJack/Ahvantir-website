-- ============================================================
-- Seed: the Aru'Mas city map
--
-- Run AFTER supabase-maps-schema.sql, and AFTER uploading the map image to the
-- 'maps' Storage bucket as 'arumas-city-map.jpeg'.
--
-- Source: the World Anvil map "Aru'Mas The City of Beginings", extracted
-- 2026-10-02. 33 point markers, 10 district polygons, 7 quarter polygons.
--
-- Coordinates are pixels in the 4962 x 3508 image, origin TOP-LEFT. World Anvil
-- stores points as geoX/geoY from the bottom-left, and polygon vertices as
-- lat,lng from the bottom-left (axis order reversed relative to its own points).
-- Both were converted when this file was generated; nothing below needs flipping.
--
-- Re-running is safe: the map row upserts on slug and its markers are replaced.
-- ============================================================

insert into maps (slug, title, description, storage_path, image_width, image_height, sort_order, is_published)
values (
  'arumas-city',
  'Aru''Mas',
  'The city of Aru''Mas: ten districts, seven quarters and the harbour approach.',
  'arumas-city-map.jpeg',
  4962, 3508, 0, true
)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  storage_path = excluded.storage_path,
  image_width  = excluded.image_width,
  image_height = excluded.image_height,
  is_published = excluded.is_published;

-- Replace this map's markers so the seed is idempotent.
delete from map_markers
where map_id = (select id from maps where slug = 'arumas-city');

-- ── Districts and quarters (polygons) ───────────────────────
insert into map_markers (map_id, kind, title, article_slug, points, color, group_name)
select * from (values
  ((select id from maps where slug = 'arumas-city'), 'area', 'Artisans Alley', 'artisans-alley', '[[2713,1752],[2814,1828],[2836,1851],[2892,1849],[2904,1873],[2962,1872],[2965,1913],[2992,1922],[3036,1897],[3067,1895],[3052,1844],[3067,1791],[2999,1609],[3014,1567],[2996,1499],[3002,1462],[2880,1399],[2855,1345],[2749,1323],[2670,1309],[2645,1369],[2691,1424],[2686,1539],[2703,1553],[2698,1620],[2732,1630]]'::jsonb, '#980106', 'Quarters'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'Driftmoor Haven', 'driftmoor-haven', '[[2411,3074],[2415,3009],[2448,2978],[2452,2792],[2443,2515],[2452,2372],[2473,2279],[2564,2302],[2578,2196],[2647,2063],[2728,1981],[2726,1964],[2768,1929],[2793,1984],[2864,1977],[2965,1917],[2991,1928],[3036,1901],[3068,1899],[3073,1929],[3102,1957],[3131,1953],[3174,1974],[3200,1976],[3231,2008],[3254,2020],[3329,2020],[3385,2012],[3452,2040],[3471,2075],[3507,2101],[3538,2114],[3576,2199],[3567,2233],[3583,2267],[3582,2304],[3615,2375],[3610,2403],[3622,2432],[3591,2481],[3582,2530],[3607,2545],[3630,2592],[3623,2627],[3563,2693],[3518,2688],[3480,2693],[3353,2816],[3350,2855],[3292,2899],[3262,2908],[3243,2952],[3265,3023],[3225,3026],[3155,3046],[3034,3068],[2900,3073],[2441,3077]]'::jsonb, '#27B7B0', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'Ragmarket', 'ragmarket', '[[1166,2779],[1342,2861],[1539,2929],[1672,2981],[1783,3010],[1940,3034],[2017,3051],[2307,3076],[2898,3075],[2977,3070],[3034,3069],[3147,3050],[3220,3029],[3261,3029],[3199,3098],[3209,3159],[3170,3215],[3169,3241],[3155,3300],[3126,3338],[3092,3342],[3085,3359],[3019,3340],[2971,3354],[2937,3351],[2903,3326],[2845,3366],[2814,3324],[2787,3338],[2742,3314],[2714,3340],[2672,3340],[2649,3320],[2628,3338],[2583,3338],[2524,3366],[2459,3345],[2418,3399],[2314,3407],[2285,3362],[2205,3317],[2160,3320],[2110,3303],[2080,3315],[2035,3311],[2011,3330],[1959,3332],[1904,3369],[1865,3328],[1814,3325],[1758,3316],[1709,3344],[1669,3326],[1628,3343],[1592,3330],[1544,3338],[1512,3291],[1465,3289],[1421,3232],[1433,3174],[1385,3119],[1341,3145],[1299,3117],[1246,3144],[1233,3175],[1175,3175],[1110,3110],[1099,3039],[1119,2980],[1113,2918],[1134,2869],[1115,2828],[1133,2786]]'::jsonb, '#5D60BE', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'Sailors Row', 'sailors-row', '[[2965,3070],[2962,3023],[3032,3019],[3033,2890],[3015,2885],[3013,2856],[3064,2849],[3068,2833],[3010,2743],[2987,2792],[2940,2794],[2940,2812],[2861,2815],[2863,2959],[2843,2959],[2842,3027],[2831,3027],[2830,3070]]'::jsonb, '#0B49F6', 'Quarters'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'Spireview', 'spireview', '[[1586,1685],[1583,1745],[1382,1808],[1351,1799],[1294,1818],[1307,1856],[1271,1961],[1310,1978],[1306,2037],[1238,2038],[1237,2136],[1273,2151],[1277,2186],[1306,2194],[1311,2302],[1331,2305],[1334,2344],[1311,2352],[1311,2483],[1370,2487],[1370,2542],[1350,2569],[1334,2565],[1305,2657],[1244,2634],[1232,2660],[1216,2662],[1197,2683],[1199,2702],[1185,2739],[1167,2773],[1340,2856],[1541,2926],[1677,2980],[1786,3008],[1941,3029],[2015,3047],[2303,3075],[2409,3073],[2412,3009],[2448,2978],[2440,2513],[2450,2373],[2470,2276],[2465,2223],[2444,2177],[2401,2123],[2217,1991],[2050,1829],[1993,1788],[1906,1753],[1696,1698]]'::jsonb, '#9F34F8', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'Stonegate', 'stonegate', '[[1346,734],[1375,779],[1978,781],[1978,867],[1922,865],[1920,1153],[1988,1168],[2232,1090],[2228,1065],[2458,993],[2612,896],[2654,726],[2814,574],[2920,571],[2939,596],[3058,508],[3121,397],[3173,345],[3182,318],[3413,322],[3246,217],[3219,160],[3149,137],[3109,169],[3049,143],[3030,166],[2926,168],[2913,198],[2791,196],[2753,216],[2715,212],[2614,232],[2578,270],[2538,270],[2532,346],[2362,369],[2293,378],[2128,407],[1837,480],[1633,559],[1524,608]]'::jsonb, '#F87834', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'Temple Way', 'temple-way', '[[1345,871],[1340,1214],[1912,1221],[1920,867],[1975,869],[1975,788],[1373,787],[1342,738],[1192,869],[1234,912],[1275,965],[1340,912]]'::jsonb, '#99FADC', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Aurora Song District', 'aurora-song-district', '[[2472,2272],[2558,2293],[2573,2196],[2641,2061],[2723,1978],[2721,1962],[2770,1926],[2796,1978],[2861,1973],[2966,1915],[2992,1926],[3038,1897],[3066,1897],[3052,1843],[3067,1790],[3000,1610],[3014,1565],[2997,1499],[3001,1461],[2881,1400],[2856,1345],[2856,1270],[2797,1051],[2779,1023],[2742,991],[2718,921],[2731,873],[2627,837],[2613,899],[2482,976],[2458,996],[2310,1045],[2232,1065],[2238,1094],[1991,1174],[1921,1162],[1916,1224],[1818,1223],[1739,1317],[1661,1312],[1663,1403],[1643,1471],[1610,1471],[1519,1564],[1607,1648],[1590,1688],[1696,1696],[1906,1747],[1992,1783],[2053,1828],[2222,1990],[2296,2041],[2402,2122],[2445,2178],[2468,2221]]'::jsonb, '#F83436', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Bards Quarter', 'the-performers-quarter', '[[2964,1914],[2864,1974],[2795,1979],[2767,1925],[2724,1963],[2726,1978],[2644,2060],[2576,2195],[2562,2297],[2472,2276],[2465,2220],[2443,2177],[2469,2142],[2459,2111],[2494,2050],[2493,1949],[2452,1948],[2449,1904],[2508,1903],[2512,1872],[2531,1856],[2549,1877],[2713,1752],[2815,1828],[2836,1851],[2892,1850],[2905,1874],[2961,1871]]'::jsonb, '#980154', 'Quarters'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Crowns Approach', 'crowns-approach', '[[3586,1930],[3438,1743],[3450,1657],[3589,1515],[3630,1517],[3682,1493],[3745,1489],[3772,1418],[3727,1391],[3706,1344],[3648,1357],[3589,1242],[3646,1217],[3681,1169],[3628,1115],[3588,1125],[3530,1072],[3541,1015],[3480,954],[3619,803],[3622,755],[3660,705],[3624,528],[3527,489],[3536,373],[3554,345],[3688,367],[3800,395],[3908,437],[4020,491],[4111,542],[4204,607],[4250,647],[4287,692],[4342,791],[4344,794],[4373,884],[4346,905],[4276,880],[4269,850],[4253,826],[4184,845],[4151,834],[4114,867],[4016,888],[3973,902],[3963,938],[3886,1000],[3854,1045],[3851,1074],[3808,1095],[3827,1119],[3837,1147],[3822,1188],[3848,1215],[3880,1267],[3886,1340],[3857,1369],[3838,1405],[3808,1424],[3780,1533],[3831,1558],[3849,1587],[3862,1590],[3883,1604],[3887,1636],[3896,1647],[3877,1660],[3879,1683],[3851,1733],[3861,1752],[3828,1784],[3805,1787],[3802,1788],[3771,1807],[3769,1820],[3727,1849],[3713,1835],[3697,1838],[3680,1835],[3664,1857],[3656,1861],[3643,1857],[3623,1872],[3625,1884],[3611,1895],[3611,1908],[3606,1929]]'::jsonb, '#4DA23E', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Dockyards', 'the-dockyards', '[[3216,2715],[3228,2681],[3351,2614],[3340,2548],[3368,2538],[3350,2416],[3200,2439],[3197,2517],[3157,2538],[3104,2543],[3065,2589],[3071,2683],[3114,2729]]'::jsonb, '#06E2B2', 'Quarters'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Far Farewell Market District', 'far-farewell-market-district', '[[3064,2590],[2943,2605],[2888,2577],[2818,2525],[2818,2498],[2731,2485],[2725,2436],[2714,2430],[2721,2214],[2735,2206],[2954,2182],[2956,2193],[3010,2188],[3018,2222],[3116,2216],[3207,2254],[3187,2243],[3203,2157],[3308,2154],[3321,2224],[3498,2214],[3504,2289],[3398,2300],[3395,2354],[3348,2399],[3350,2417],[3198,2440],[3196,2518],[3158,2538],[3104,2542]]'::jsonb, '#082883', 'Quarters'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Fishermans Quarter', 'the-fishermens-quarter', '[[3353,2852],[3358,2812],[3362,2737],[3229,2683],[3216,2715],[3175,2720],[3115,2731],[3073,2684],[3041,2701],[3042,2717],[3002,2732],[3068,2836],[3065,2852],[3014,2859],[3016,2887],[3032,2891],[3034,2964],[3034,3024],[2967,3028],[2969,3068],[3034,3064],[3153,3047],[3263,3012],[3246,2951],[3261,2905],[3291,2900]]'::jsonb, '#710BF6', 'Quarters'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Luminous Reach', 'luminous-reach', '[[3001,1461],[2881,1398],[2858,1339],[2853,1274],[2797,1053],[2780,1026],[2741,993],[2721,925],[2731,877],[2629,840],[2660,731],[2759,632],[2815,581],[2917,578],[2936,601],[2955,604],[3062,514],[3109,431],[3127,398],[3169,360],[3181,322],[3282,318],[3552,343],[3535,372],[3525,491],[3624,531],[3660,705],[3620,758],[3618,803],[3477,958],[3540,1014],[3527,1065],[3506,1084],[3501,1113],[3475,1129],[3478,1161],[3481,1212],[3434,1233],[3406,1220],[3332,1222],[3295,1271],[3316,1318],[3345,1386],[3323,1426],[3252,1446],[3230,1456],[3195,1407],[3162,1379],[3156,1387],[3130,1373],[3108,1383],[3093,1404],[3067,1408],[3049,1403],[3014,1434]]'::jsonb, '#BF63F0', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Oasis of Spirits', 'the-oasis-of-spirits', '[[2274,1305],[2246,1427],[2292,1436],[2278,1524],[2310,1612],[2295,1628],[2310,1665],[2359,1648],[2392,1680],[2405,1758],[2419,1774],[2417,1818],[2511,1820],[2551,1876],[2720,1746],[2730,1632],[2697,1622],[2699,1556],[2684,1540],[2686,1428],[2645,1372],[2607,1377],[2601,1364],[2548,1343],[2515,1353],[2471,1332],[2425,1323],[2432,1254],[2416,1222],[2352,1242],[2358,1279]]'::jsonb, '#F34AD8', 'Quarters'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'The Spillway', 'the-spillway', '[[696,2177],[705,2135],[756,2094],[810,2086],[816,2053],[960,2050],[1007,1990],[1085,1987],[1097,1953],[1121,1961],[1206,1958],[1257,1827],[1157,1852],[1156,1854],[1144,1818],[1103,1824],[1087,1774],[1070,1765],[1070,1725],[1097,1703],[1084,1678],[1060,1647],[989,1645],[987,1611],[800,1611],[775,1641],[666,1592],[647,1644],[593,1639],[560,1652],[509,1651],[481,1697],[430,1734],[373,1784],[376,1813],[328,1838],[345,1881],[338,1973],[362,1986],[363,2021],[463,2067],[473,2105],[507,2110],[535,2170],[598,2160],[630,2172]]'::jsonb, '#07BA4B', 'Districts'),
  ((select id from maps where slug = 'arumas-city'), 'area', 'Upper and Lower Hearthstone', 'hearthstone', '[[700,2177],[882,2471],[1008,2645],[1081,2716],[1170,2769],[1193,2702],[1194,2675],[1214,2659],[1223,2655],[1243,2628],[1303,2650],[1333,2560],[1349,2565],[1367,2537],[1368,2487],[1312,2483],[1309,2349],[1331,2342],[1331,2302],[1312,2300],[1306,2191],[1276,2182],[1273,2149],[1238,2134],[1235,2036],[1304,2032],[1311,1978],[1271,1960],[1307,1854],[1295,1818],[1349,1793],[1385,1805],[1582,1742],[1582,1684],[1603,1649],[1516,1564],[1607,1465],[1639,1464],[1660,1400],[1657,1308],[1739,1313],[1813,1220],[1336,1216],[1340,913],[1277,963],[1191,871],[990,1067],[886,1195],[820,1291],[756,1408],[670,1587],[776,1634],[801,1604],[988,1606],[993,1640],[1061,1643],[1099,1698],[1073,1725],[1073,1761],[1090,1770],[1105,1819],[1147,1816],[1160,1849],[1256,1825],[1206,1956],[1119,1960],[1097,1951],[1080,1986],[1008,1991],[962,2051],[817,2053],[810,2086],[756,2094],[708,2133]]'::jsonb, '#076CBA', 'Districts')) as v(map_id, kind, title, article_slug, points, color, group_name);

-- ── Locations (points) ──────────────────────────────────────
insert into map_markers (map_id, kind, title, article_slug, geo_x, geo_y, color, group_name)
select * from (values
  ((select id from maps where slug = 'arumas-city'), 'point', 'Spiritsway Passage', 'spiritsway-passage', 3112, 338, '#c9a227', 'Landmarks'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Crowns Approach', 'order-of-harmony-hospitals', 3461, 489, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Stonegate', 'order-of-harmony-hospitals', 2679, 497, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Roost', 'roost', 2630, 678, '#c9a227', 'Government Buildings'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Adventurers Guild Association — Stonegate', 'adventurers-guild-association', 2019, 851, '#5e9e8f', 'Adventurers Guild Association Houses'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Arrandak Academy', 'arrandak-academy', 2924, 942, '#c9a227', 'Schools'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Adventurers Guild Association — Luminous Reach', 'adventurers-guild-association', 3100, 951, '#5e9e8f', 'Adventurers Guild Association Houses'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'The LaCroi Institute of Spiritology', 'the-lacroi-institute-of-spiritology', 2419, 985, '#c9a227', 'Schools'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Luminous Reach / Driftmoor area', 'order-of-harmony-hospitals', 3785, 1072, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Horizon Watch Arena', 'horizon-watch-arena', 3109, 1188, '#c9a227', 'Landmarks'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Hearthstone/Upper area', 'order-of-harmony-hospitals', 1380, 1191, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Miss Belliosa Blossom''s Emporium of Exotic Entities', 'miss-belliosa-blossoms-emporium-of-exotic-entities', 2738, 1484, '#c9a227', 'Shops'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Adventurers Guild Association — Hearthstone', 'adventurers-guild-association', 1341, 1526, '#5e9e8f', 'Adventurers Guild Association Houses'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Graveyard Rift', 'graveyard-rift', 1651, 1569, '#c9a227', 'Taverns and Inns'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Hearthstone (Upper)', 'order-of-harmony-hospitals', 1232, 1680, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Aurora Song / Central', 'order-of-harmony-hospitals', 2188, 1694, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'The Gilded Bastion', 'the-gilded-bastion', 3587, 1758, '#c9a227', 'Government Buildings'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Adventurers Guild Association — Aurora Song District', 'adventurers-guild-association', 2471, 1773, '#5e9e8f', 'Adventurers Guild Association Houses'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Adventurers Guild Association — Hearthstone (Lower) / Spillway border', 'adventurers-guild-association', 866, 1898, '#5e9e8f', 'Adventurers Guild Association Houses'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Lower Hearthstone / Spillway', 'order-of-harmony-hospitals', 685, 2015, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Spireview / Central', 'order-of-harmony-hospitals', 1795, 2157, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Ilderas Public Archive', 'ilderas-public-archive', 1148, 2164, '#c9a227', 'Government Buildings'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'The Abode of Tarran Finn', 'the-abode-of-tarran-finn', 1066, 2168, '#c9a227', 'Residences'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Far Farewell Trade Co-op', 'far-farewell-trade-co-op', 3252, 2247, '#c9a227', 'Shops'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Many Worlds Pot and Barrel', 'many-worlds-pot-and-barrel', 2808, 2332, '#c9a227', 'Taverns and Inns'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Galvantis Arms, Armor, and Automatons', 'galvantis-arms-armor-and-automatons', 1496, 2380, '#c9a227', 'Shops'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Heartspire', 'heartspire', 1793, 2392, '#c9a227', 'Government Buildings'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Adventurers Guild Association — Spireview', 'adventurers-guild-association', 2193, 2543, '#5e9e8f', 'Adventurers Guild Association Houses'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Driftmoor Haven', 'order-of-harmony-hospitals', 2787, 2595, '#c2645a', 'Hospitals'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Adventurers Guild Association — Driftmoor Haven', 'adventurers-guild-association', 2890, 2805, '#5e9e8f', 'Adventurers Guild Association Houses'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Merchants Guild Grand Hall', 'merchants-guild-grand-hall', 2580, 2888, '#c9a227', 'Government Buildings'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Kragg''s Menagerie of Marvels', 'kraggs-menagerie-of-marvels', 3123, 2981, '#c9a227', 'Shops'),
  ((select id from maps where slug = 'arumas-city'), 'point', 'Order of Harmony Hospitals — Spillway / Southern', 'order-of-harmony-hospitals', 1599, 3240, '#c2645a', 'Hospitals')) as v(map_id, kind, title, article_slug, geo_x, geo_y, color, group_name);

-- ── DM decision, 2026-10-03: hide the seven quarter polygons ────────────────
-- The quarters made the map too cluttered to read, so only the ten main
-- districts are drawn. Their articles are unaffected and still linked from the
-- point markers and the locations list.
--
-- Soft delete rather than removing the rows: these are hand-traced polygons
-- (172 vertices across the seven) recovered from World Anvil and they cannot be
-- redrawn faithfully. Keeping them here, stamped, means the seed stays the
-- complete record of the extraction while the map shows what the DM wants.
--
-- To bring them back:
--   update map_markers set deleted_at = null
--    where kind = 'area' and group_name = 'Quarters';
update map_markers
   set deleted_at = now()
 where map_id = (select id from maps where slug = 'arumas-city')
   and kind = 'area'
   and group_name = 'Quarters'
   and deleted_at is null;
