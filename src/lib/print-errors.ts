import { PrintError, PrinterErrorCode } from '@mmote/niimbluelib'
import type { Lang } from '../types'

const messages: Record<number, Record<Lang, string>> = {
  [PrinterErrorCode.CoverOpen]: {
    ru: 'Открыта крышка. Закройте её и повторите печать.',
    en: 'The cover is open. Close it and print again.',
  },
  [PrinterErrorCode.LackPaper]: {
    ru: 'Нет бумаги. Вставьте рулон этикеток.',
    en: 'Out of paper. Load a label roll.',
  },
  [PrinterErrorCode.LowBattery]: {
    ru: 'Слишком низкий заряд. Зарядите принтер и повторите.',
    en: 'The battery is too low. Charge the printer and try again.',
  },
  [PrinterErrorCode.BatteryException]: {
    ru: 'Сбой батареи. Подключите питание и повторите печать.',
    en: 'Battery fault. Connect power and print again.',
  },
  [PrinterErrorCode.UserCancel]: {
    ru: 'Печать отменена на принтере.',
    en: 'Printing was cancelled on the printer.',
  },
  [PrinterErrorCode.DataError]: {
    ru: 'Принтер отклонил данные. Проверьте размер этикетки и задачу печати.',
    en: 'The printer rejected the data. Check the label size and print task.',
  },
  [PrinterErrorCode.Overheat]: {
    ru: 'Перегрев головки. Дайте принтеру остыть и повторите.',
    en: 'The print head is too hot. Let the printer cool down and try again.',
  },
  [PrinterErrorCode.PaperOutException]: {
    ru: 'Бумага закончилась или подаётся с ошибкой. Проверьте рулон.',
    en: 'Paper ran out or failed to feed. Check the roll.',
  },
  [PrinterErrorCode.PrinterBusy]: {
    ru: 'Принтер занят. Подождите и повторите.',
    en: 'The printer is busy. Wait and try again.',
  },
  [PrinterErrorCode.NoPrinterHead]: {
    ru: 'Печатающая головка не обнаружена.',
    en: 'The print head was not detected.',
  },
  [PrinterErrorCode.TemperatureLow]: {
    ru: 'Слишком низкая температура головки.',
    en: 'The print head is too cold.',
  },
  [PrinterErrorCode.PrinterHeadLoose]: {
    ru: 'Печатающая головка плохо закреплена. Закройте крышку до щелчка.',
    en: 'The print head is loose. Close the cover until it clicks.',
  },
  [PrinterErrorCode.NoRibbon]: {
    ru: 'Нет красящей ленты.',
    en: 'No ribbon is installed.',
  },
  [PrinterErrorCode.WrongRibbon]: {
    ru: 'Неподходящая красящая лента.',
    en: 'The ribbon does not match this printer.',
  },
  [PrinterErrorCode.UsedRibbon]: {
    ru: 'Красящая лента израсходована.',
    en: 'The ribbon is used up.',
  },
  [PrinterErrorCode.WrongPaper]: {
    ru: 'Бумага не подходит к заданию. Проверьте тип этикетки и рулон.',
    en: 'The paper does not match the job. Check the label type and roll.',
  },
  [PrinterErrorCode.SetPaperFail]: {
    ru: 'Не удалось выбрать тип бумаги. Проверьте рулон и закройте крышку.',
    en: 'Could not set the paper type. Check the roll and close the cover.',
  },
  [PrinterErrorCode.SetPrintModeFail]: {
    ru: 'Принтер не принял режим печати.',
    en: 'The printer rejected the print mode.',
  },
  [PrinterErrorCode.SetPrintDensityFail]: {
    ru: 'Принтер не принял плотность. Выберите значение из диапазона модели.',
    en: 'The printer rejected the density. Choose a value in the model range.',
  },
  [PrinterErrorCode.WriteRfidFail]: {
    ru: 'Ошибка 20: прошивка принтера не записала RFID рулона. Официальное приложение Niimbot отказывает так же — это считыватель или прошивка, не Метка. Смена задачи печати RFID не отключает.',
    en: 'Error 20: the printer firmware could not write the roll RFID. The official Niimbot app refuses the same way. This is the reader or the firmware, not Metka. Changing the print task does not turn RFID off.',
  },
  [PrinterErrorCode.SetMarginFail]: {
    ru: 'Не удалось установить поля.',
    en: 'Could not set the margins.',
  },
  [PrinterErrorCode.CommunicationException]: {
    ru: 'Сбой связи. Поднесите принтер ближе и подключитесь снова.',
    en: 'Communication failed. Move the printer closer and connect again.',
  },
  [PrinterErrorCode.Disconnect]: {
    ru: 'Принтер отключился во время печати.',
    en: 'The printer disconnected during printing.',
  },
  [PrinterErrorCode.CanvasParameterError]: {
    ru: 'Неверный размер страницы. Для D11_H этикетка считается в 300 DPI: 12 мм — это 142 точки.',
    en: 'Invalid page size. D11_H labels are 300 DPI: 12 mm is 142 dots.',
  },
  [PrinterErrorCode.RotationParameterException]: {
    ru: 'Неверные параметры поворота страницы.',
    en: 'Invalid page rotation.',
  },
  [PrinterErrorCode.JsonParameterException]: {
    ru: 'Принтер не принял параметры задания.',
    en: 'The printer rejected the job parameters.',
  },
  [PrinterErrorCode.B3sAbnormalPaperOutput]: {
    ru: 'Сбой подачи бумаги.',
    en: 'Paper feed failed.',
  },
  [PrinterErrorCode.ECheckPaper]: {
    ru: 'Принтер просит проверить бумагу.',
    en: 'The printer asked to check the paper.',
  },
  [PrinterErrorCode.RfidTagNotWritten]: {
    ru: 'Ошибка 29: прошивка не записала RFID рулона. Официальное приложение ведёт себя так же. Это состояние принтера, не ошибка Метки.',
    en: 'Error 29: the firmware did not write the roll RFID. The official app behaves the same way. This is the printer, not Metka.',
  },
  [PrinterErrorCode.SetPrintDensityNoSupport]: {
    ru: 'Эта модель не поддерживает выбранную плотность.',
    en: 'This model does not support the selected density.',
  },
  [PrinterErrorCode.SetPrintModeNoSupport]: {
    ru: 'Эта модель не поддерживает выбранный режим печати.',
    en: 'This model does not support the selected print mode.',
  },
  [PrinterErrorCode.SetPrintLabelMaterialError]: {
    ru: 'Ошибка материала этикетки. Проверьте тип этикетки и рулон.',
    en: 'Label material error. Check the label type and the roll.',
  },
  [PrinterErrorCode.SetPrintLabelMaterialNoSupport]: {
    ru: 'Материал этикетки не поддерживается.',
    en: 'This label material is not supported.',
  },
  [PrinterErrorCode.NotSupportWrittenRfid]: {
    ru: 'Ошибка 34: прошивка не поддерживает запись RFID этого рулона. Официальное приложение отказывает так же.',
    en: 'Error 34: the firmware cannot write this roll RFID. The official app refuses the same way.',
  },
  [PrinterErrorCode.IllegalPage]: {
    ru: 'Недопустимый размер страницы. Сверьте миллиметры с DPI принтера.',
    en: 'Illegal page size. Match the millimetres to the printer DPI.',
  },
  [PrinterErrorCode.IllegalRibbonPage]: {
    ru: 'Недопустимый размер для ленты.',
    en: 'Illegal page size for this ribbon.',
  },
  [PrinterErrorCode.ReceiveDataTimeout]: {
    ru: 'Принтер не дождался данных. Повторите печать; для Bluetooth можно увеличить интервал пакетов.',
    en: 'The printer timed out waiting for data. Print again; on Bluetooth, raise the packet interval.',
  },
  [PrinterErrorCode.NonDedicatedRibbon]: {
    ru: 'Установлена неродная лента.',
    en: 'A non-genuine ribbon is installed.',
  },
}

function reasonOf(error: unknown): number | undefined {
  if (error instanceof PrintError) return error.reasonId
  if (error && typeof error === 'object' && 'reasonId' in error) {
    const reason = (error as { reasonId?: unknown }).reasonId
    if (typeof reason === 'number') return reason
  }
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const match = /Print error (\d+)/.exec(message)
  return match ? Number(match[1]) : undefined
}

export function formatPrintError(error: unknown, lang: Lang): string {
  const code = reasonOf(error)
  const known = code !== undefined ? messages[code]?.[lang] : undefined
  if (known) return known
  const raw = error instanceof Error ? error.message : String(error)
  const name = code !== undefined ? PrinterErrorCode[code] : ''
  if (lang === 'ru') {
    return name ? `Печать не выполнена: ошибка ${code} (${name}). ${raw}` : `Печать не выполнена: ${raw}`
  }
  return name ? `Print failed: error ${code} (${name}). ${raw}` : `Print failed: ${raw}`
}
