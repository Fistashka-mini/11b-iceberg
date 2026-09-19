// ============================================================
//  СПИСОК КЛАССА (стартовый). На айсберге — только имя.
//  Правки текста/глубины и новые люди пишутся в общее облако
//  и подтягиваются у всех, у кого есть ссылка.
//  Полные ФИО в коде — запасной список; архив = лог изменений (по IP).
// ============================================================

export const CLASS_INFO = {
  title: '11-Б',
  years: '2016 — 2027',
  subtitle: 'Айсберг одноклассников',
};

export const TIERS = [
  { title: 'Поверхность', subtitle: 'То, что знают все' },
  { title: 'Мелководье', subtitle: 'Об этом шепчутся на переменах' },
  { title: 'Глубина', subtitle: 'Только для своих' },
  { title: 'Дно', subtitle: 'Учителя не в курсе' },
  { title: 'Бездна', subtitle: 'Об этом не говорят вслух' },
];

// name     — на айсберге и в карточке
// fullName — только в архиве (для владельца)
const RAW = [
  { id: 'garbolinska', name: 'Єлизавета', fullName: 'Гарболінська Єлизавета Володимирівна' },
  { id: 'glushkova', name: 'Олександра', fullName: 'Глушкова Олександра Віталіївна' },
  { id: 'gritsun', name: 'Крістіна', fullName: 'Грицун Крістіна Іванівна' },
  { id: 'zhmurko', name: 'Олеся', fullName: 'Жмурко Олеся Сергіївна' },
  { id: 'ivaskevych', name: 'Ренат', fullName: 'Іваськевич Ренат Романович' },
  { id: 'ivzhenko', name: 'Денис', fullName: 'Івженко Денис Андрійович' },
  { id: 'kalyna', name: 'Артем', fullName: 'Калина Артем Олександрович' },
  { id: 'kyrzha', name: 'Руслан', fullName: 'Киржа Руслан Андрійович' },
  { id: 'kovalenko', name: 'Вадим', fullName: 'Коваленко Вадим Олександрович' },
  { id: 'kozak', name: 'Данило', fullName: 'Козак Данило Михайлович' },
  { id: 'kryulin', name: 'Микита', fullName: 'Криулін Микита Андрійович' },
  { id: 'ksenzova', name: 'Кристіна', fullName: 'Ксензова Кристіна Олексіївна' },
  { id: 'lavrenchuk', name: 'Ксенія', fullName: 'Лавренчук Ксенія Вікторівна' },
  { id: 'lavrys', name: 'Аліса', fullName: 'Лаврись Аліса Ярославівна' },
  { id: 'livak', name: 'Юрій', fullName: 'Лівак Юрій Дмитрович' },
  { id: 'livkutnyk', name: 'Олександр', fullName: 'Лівкутник Олександр Юрійович' },
  { id: 'marchenko', name: 'Тимур', fullName: 'Марченко Тимур Олегович' },
  { id: 'melnyk', name: 'Ульяна', fullName: 'Мельник Ульяна Олександрівна' },
  { id: 'miahykyi', name: 'Іван', fullName: 'Мягкий Іван Андрійович' },
  { id: 'nekrashevych', name: 'Владислав', fullName: 'Некрашевич Владислав Анатолійович' },
  { id: 'nikulshyn', name: 'Владислав', fullName: 'Нікульшин Владислав Андрійович' },
  { id: 'ostapchuk', name: 'Денис', fullName: 'Остапчук Денис Русланович' },
  { id: 'panchenko', name: 'Ксенія', fullName: 'Панченко Ксенія Андріївна' },
  { id: 'pereyaslivskyi', name: 'Максим', fullName: 'Переяслівський Максим Олександрович' },
  { id: 'pryshchepa', name: 'Анна', fullName: 'Прищепа Анна Андріївна' },
  { id: 'skorina', name: 'Софія', fullName: 'Скоріна Софія Сергіївна' },
  { id: 'strilko', name: 'Владислав', fullName: 'Стрілко Владислав Сергійович' },
  { id: 'sus', name: 'Кірілл', fullName: 'Сус Кірілл Євгенович' },
  { id: 'fedchyshena', name: 'Ірина', fullName: 'Федчишена Ірина Олександрівна' },
  { id: 'fomenko', name: 'Юлія', fullName: 'Фоменко Юлія Олександрівна' },
  { id: 'chulovskyi', name: "В'ячеслав", fullName: "Чуловский В'ячеслав В'ячеславович" },
  { id: 'yasko', name: 'Крістіна', fullName: 'Ясько Крістіна Володимирівна' },
  { id: 'tabatadze', name: 'Табатадзе', fullName: 'Табатадзе' },
  { id: 'nastya', name: 'Настя', fullName: 'Настя' },
  { id: 'ostrovskyi', name: 'Островський', fullName: 'Островський' },
  { id: 'yaremchuk', name: 'Яремчук', fullName: 'Яремчук' },
  { id: 'tverdokhlib', name: 'Твердохліб', fullName: 'Твердохліб' },
  { id: 'maksymchuk', name: 'Максимчук', fullName: 'Максимчук' },
];

const TIER_COUNT = TIERS.length;

export const CLASSMATES = RAW.map((person, i) => {
  const tier = i % TIER_COUNT;
  const slot = Math.floor(i / TIER_COUNT);
  const perTier = Math.ceil(RAW.length / TIER_COUNT);
  const angle = -62 + (124 * (slot + 0.5)) / perTier + (tier % 2 === 0 ? -6 : 6);
  const offset = ((slot % 3) - 1) * 0.4;
  return {
    ...person,
    nickname: '',
    tier,
    angle: Math.round(angle * 10) / 10,
    offset,
    photo: '',
    about: '',
    facts: [],
    gallery: [],
  };
});
