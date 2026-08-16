import { and, count, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { likes, users } from "@/db/schema";
import { localDayString } from "./wallet-constants";
import { getOrCreateReferralCode } from "./wallet";
import type { RoleId } from "./types";

/** tgId демо-пользователя (текущего пользователя в режиме без бота) */
export const DEMO_TG_ID = 777_777_777;

/** Диапазон tgId для засеянных демо-анкет */
const DEMO_SEED_MIN_TG_ID = 9_000_000_000;

type DemoProfile = {
  tgId: number;
  username: string;
  firstName: string;
  name: string;
  role: RoleId;
  /** Кого ищет этот игрок в тиммейты */
  lookingFor: RoleId[];
  /** Картинка карточки (палитра) */
  banner: string | null;
  mmr: number;
  age: number;
  profileLink: string;
  description: string;
};

const DEMO_PROFILES: DemoProfile[] = [
  {
    tgId: 9_000_000_001,
    username: "artem_carry",
    firstName: "Артём",
    name: "Артём",
    role: "pos1",
    lookingFor: ["pos4", "pos5"],
    banner: "palette:1",
    mmr: 3200,
    age: 24,
    profileLink: "https://ru.dotabuff.com/players/104283315",
    description: "Ищу адекватный стак для пт-драйва. Играю в основном вечерами, без токсика. Есть опыт в командных играх.",
  },
  {
    tgId: 9_000_000_002,
    username: "lena_supp",
    firstName: "Лена",
    name: "Лена",
    role: "pos5",
    lookingFor: ["pos1", "pos2"],
    banner: "palette:3",
    mmr: 2100,
    age: 21,
    profileLink: "https://stratz.com/players/128460034",
    description: "Саппорт с хорошим микро, люблю играть в пати с друзьями. Нужна компания для вечернего паба.",
  },
  {
    tgId: 9_000_000_003,
    username: "max_mid",
    firstName: "Макс",
    name: "Макс",
    role: "pos2",
    lookingFor: ["pos3", "pos4", "pos5"],
    banner: "palette:4",
    mmr: 4500,
    age: 27,
    profileLink: "https://stratz.com/players/142207840",
    description: "Мидлейнер, 10k часов. Хочу собрать команду для турниров и боевых кубков.",
  },
  {
    tgId: 9_000_000_004,
    username: "dima_offlane",
    firstName: "Дима",
    name: "Дима",
    role: "pos3",
    lookingFor: ["pos2", "pos4"],
    banner: "palette:3",
    mmr: 2800,
    age: 25,
    profileLink: "https://ru.dotabuff.com/players/117838401",
    description: "Оффлейнер-инициатор. Спокойный, не флеймлю. Выходные полностью свободны.",
  },
  {
    tgId: 9_000_000_005,
    username: "anya_roam",
    firstName: "Аня",
    name: "Аня",
    role: "pos4",
    lookingFor: ["pos1", "pos2", "pos3"],
    banner: "palette:5",
    mmr: 3600,
    age: 22,
    profileLink: "https://stratz.com/players/136285077",
    description: "Люблю активный роуминг с 4-й позиции. Ищу стак с микрофоном и желанием играть агрессивно.",
  },
  {
    tgId: 9_000_000_006,
    username: "sergey_carry",
    firstName: "Сергей",
    name: "Сергей",
    role: "pos1",
    lookingFor: ["pos4", "pos5"],
    banner: "palette:2",
    mmr: 5300,
    age: 29,
    profileLink: "https://ru.dotabuff.com/players/98124509",
    description: "Керри с сильными лейт-героями. Ищу пятёрку и оффлейн для рейтинговых игр.",
  },
  {
    tgId: 9_000_000_007,
    username: "oleg_mid",
    firstName: "Олег",
    name: "Олег",
    role: "pos2",
    lookingFor: ["pos3", "pos4", "pos5"],
    banner: "palette:2",
    mmr: 1900,
    age: 19,
    profileLink: "https://stratz.com/players/151770284",
    description: "Начинающий мид, хочу подняться с 2к. Ищу наставника или стак похожего уровня.",
  },
  {
    tgId: 9_000_000_008,
    username: "katya_supp",
    firstName: "Катя",
    name: "Катя",
    role: "pos5",
    lookingFor: ["pos1", "pos2", "pos4"],
    banner: "palette:5",
    mmr: 4100,
    age: 26,
    profileLink: "https://ru.dotabuff.com/players/122468753",
    description: "Фулл-саппорт, люблю сейв-героев. Играю каждый вечер после 20:00 МСК.",
  },
  {
    tgId: 9_000_000_009,
    username: "nikita_off",
    firstName: "Никита",
    name: "Никита",
    role: "pos3",
    lookingFor: ["pos2"],
    banner: "palette:6",
    mmr: 6100,
    age: 30,
    profileLink: "https://stratz.com/players/105993842",
    description: "Высокий оффлейн, есть опыт в плей-офф любительских лиг. Ищу серьёзную команду.",
  },
  {
    tgId: 9_000_000_010,
    username: "vlad_four",
    firstName: "Влад",
    name: "Влад",
    role: "pos4",
    lookingFor: ["pos1", "pos3"],
    banner: "palette:4",
    mmr: 2400,
    age: 20,
    profileLink: "https://ru.dotabuff.com/players/139823401",
    description: "Четвёрка, сетаплю фигхты и много вордю. Заходи, если нужен весёлый паб.",
  },
];

/**
 * Засеивает демо-анкеты, чтобы рекомендации не были пустыми в режиме
 * предпросмотра. Идемпотентно.
 */
export async function seedDemoProfiles(): Promise<void> {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.tgId, DEMO_SEED_MIN_TG_ID));
    if ((row?.count ?? 0) === 0) {
      await db.insert(users).values(
        DEMO_PROFILES.map((p) => ({
          tgId: p.tgId,
          username: p.username,
          firstName: p.firstName,
          name: p.name,
          role: p.role,
          lookingFor: p.lookingFor,
          banner: p.banner,
          mmr: p.mmr,
          age: p.age,
          profileLink: p.profileLink,
          description: p.description,
          lastName: null,
          photoUrl: null,
          isActive: true,
          // Демо-анкеты моделируют игроков, прошедших регистрацию
          onboardedAt: new Date(),
        })),
      );
    }
    await seedDemoWallet();
    await seedDemoMatches();
  } catch {
    // Не ломаем запрос, если сид не прошёл (например, таблиц ещё нет)
  }
}

/**
 * Демо-кошелёк: реферальные коды для всех демо-профилей,
 * пара рефералов у демо-пользователя и стартовый стрик.
 */
async function seedDemoWallet(): Promise<void> {
  try {
    // Реферальные коды демо-профилям
    const rows = await db
      .select({ tgId: users.tgId })
      .from(users)
      .where(and(gte(users.tgId, DEMO_SEED_MIN_TG_ID), isNull(users.referralCode)));
    for (const r of rows) await getOrCreateReferralCode(r.tgId);

    // Демо-пользователь привёл двух рефералов
    await db
      .update(users)
      .set({ referredByTgId: DEMO_TG_ID })
      .where(
        and(
          inArray(users.tgId, [9_000_000_001, 9_000_000_002]),
          isNull(users.referredByTgId),
        ),
      );

    // Стартовое состояние кошелька демо-пользователя:
    // 35 монет, стрик 2 дня, последний заход — вчера (сегодня можно забрать)
    const [demoRow] = await db
      .select()
      .from(users)
      .where(eq(users.tgId, DEMO_TG_ID))
      .limit(1);
    if (demoRow && !demoRow.lastClaimDay) {
      await db
        .update(users)
        .set({ currency: 35, streakDays: 2, lastClaimDay: localDayString(new Date(Date.now() - 86400000)) })
        .where(eq(users.tgId, DEMO_TG_ID));
    }
  } catch {
    // не критично
  }
}

/** Демо-совпадения: пара взаимных лайков, чтобы «Чаты» не были пустыми */
async function seedDemoMatches(): Promise<void> {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.likerTgId, DEMO_TG_ID));
    if ((row?.count ?? 0) > 0) return;

    const partners = [9_000_000_001, 9_000_000_002];
    await db
      .insert(likes)
      .values([
        ...partners.map((p) => ({
          likerTgId: DEMO_TG_ID,
          likedTgId: p,
          liked: true,
        })),
        ...partners.map((p) => ({
          likerTgId: p,
          likedTgId: DEMO_TG_ID,
          liked: true,
        })),
      ])
      .onConflictDoNothing();
  } catch {
    // не критично
  }
}
