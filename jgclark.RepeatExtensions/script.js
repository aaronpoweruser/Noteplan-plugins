var exports = (function (exports) {
  'use strict';

  //-------------------------------------------------------------------------------
  // Date functions
  // @jgclark except where shown

  const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'; // find dates of form YYYY-MM-DD

  const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?'; // find '12:23' with optional '[ ][AM|PM|am|pm]'

  new Date().toISOString().slice(0, 10); // TODO: make a friendlier string

  new Date().toISOString().slice(0, 16); // @nmn
  function unhyphenateDateString(dateString) {
    return dateString.replace(/-/g, '');
  }
  function toISODateString(dateObj) {
    return dateObj.toISOString().slice(0, 10);
  }

  //--------------------------------------------------------------------------------------------------------------------
  // Helper functions
  //------------------------------------------------------------------
  // Calculate an offset date

  function calcOffsetDate(oldDateISO, interval) {
    // Calculate an offset date, assuming:
    // - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
    // - interval is string of form nn[bdwmq], and could be negative
    // - where 'b' is weekday (i.e. Monday - Friday in English)
    // Return new date also in ISO Date format string

    /**
     * TODO: Could now use NP's own date manipulation functions:
     * Calendar.dateUnits() -> "year", "month", "day", "hour", "minute", "second"
     * .add(calendarItem) -> CalendarItem
     * .parseDateText(text) -> [DateRangeObject]
     * .dateFrom(year, month, day, hour, minute, second) -> Date
     * .unitOf(date, type) -> Int
     * .unitsUntilNow(date, type) -> Int
     * .unitsAgoFromNow(date, type) -> Int
     * Calendar.addUnitToDate(date, type, num)
     */
    const oldDate = new Date(oldDateISO);
    let daysToAdd = 0;
    const unit = interval.charAt(interval.length - 1); // get last character

    let num = Number(interval.substr(0, interval.length - 1)); // return all but last character
    // console.log(`    c_o_d: old = ${  oldDate  } / ${   num  } / ${  unit}`)

    switch (unit) {
      case 'b':
        {
          // week days
          // Method from Arjen at https://stackoverflow.com/questions/279296/adding-days-to-a-date-but-excluding-weekends
          // Avoids looping, and copes with negative intervals too
          const currentDayOfWeek = oldDate.getUTCDay(); // = day of week with Sunday = 0, ..Saturday = 6

          let dayOfWeek;

          if (num < 0) {
            dayOfWeek = (currentDayOfWeek - 12) % 7;
          } else {
            dayOfWeek = (currentDayOfWeek + 6) % 7; // % = modulo operator in JSON
          }

          if (dayOfWeek === 6) {
            num--;
          }

          if (dayOfWeek === -6) {
            num++;
          } // console.log("    c_o_d b: " + currentDayOfWeek + " / " + num + " / " + dayOfWeek)


          const numWeekends = Math.trunc((num + dayOfWeek) / 5);
          daysToAdd = num + numWeekends * 2;
          break;
        }

      case 'd':
        daysToAdd = num * 1; // need *1 otherwise treated as a string for some reason

        break;

      case 'w':
        daysToAdd = num * 7;
        break;

      case 'm':
        daysToAdd = num * 30; // on average

        break;

      case 'q':
        daysToAdd = num * 91; // on average

        break;

      case 'y':
        daysToAdd = num * 365; // on average

        break;

      default:
        console.log(`\tError in c_o_d from ${oldDate} by ${interval}`);
        break;
    }

    const newDate = new Date(oldDate);
    newDate.setDate(oldDate.getDate() + daysToAdd);
    const newDateFmt = toISODateString(newDate); // console.log(`    c_o_d: add ${  daysToAdd  } --> ${  newDateFmt}`)

    return newDateFmt;
  } //------------------------------------------------------------------
  // Process any completed(or cancelled) tasks with my extended @repeat(..) tags,
  // and also remove the HH: MM portion of any @done(...) tasks.


  async function repeats() {
    // When interval is of the form '+2w' it will duplicate the task for 2 weeks
    // after the date is was completed.
    // When interval is of the form '2w' it will duplicate the task for 2 weeks
    // after the date the task was last due.If this can't be determined,
    // then default to the first option.
    // Valid intervals are [0-9][bdwmqy].
    // To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been
    // shortened to @done(YYYY-MM-DD).
    // It includes cancelled tasks as well; to remove a repeat entirely, remoce
    // the @repeat tag from the task in NotePlan.
    // const RE_DUE_DATE = '\\s+>' + RE_DATE; // find ' >2021-02-23' etc.
    const RE_DUE_DATE_CAPTURE = `\\s+>(${RE_DATE})`; // find ' >2021-02-23' and return just date part

    const RE_DATE_TIME = `${RE_DATE} ${RE_TIME}`; // YYYY-MM-DD HH:MM[AM|PM]

    const RE_DONE_DATE_TIME = `@done\\(${RE_DATE_TIME}\\)`; // find @done(...) and return date-time part

    const RE_DONE_DATE_CAPTURE = `@done\\((${RE_DATE})( ${RE_TIME})\\)`; // find @done(...) and return date-time part

    const RE_EXTENDED_REPEAT = '@repeat\\(\\+?\\d+[bdwmqy]\\)'; // find @repeat()

    const RE_EXTENDED_REPEAT_CAPTURE = '@repeat\\((.*?)\\)'; // find @repeat() and return part inside brackets
    // Get current note details

    const {
      paragraphs,
      title
    } = Editor;

    if (paragraphs === null) {
      // No note open, or no paragraphs (perhaps empty note), so don't do anything.
      console.log('repeat: warning: No note open, or empty note.');
      return;
    }

    let lineCount = paragraphs.length;
    console.log(`\nrepeats: from note '${title}'`); // check if the last paragraph is undefined, and if so delete it from our copy

    if (paragraphs[lineCount] === null) {
      lineCount--;
    } // work out where ## Done or ## Cancelled sections start, if present


    let doneHeaderLine = 0;
    let cancelledHeaderLine = 0;

    for (let i = 0; i < lineCount; i++) {
      const p = paragraphs[i]; // console.log(i.toString() + "/" + p.lineIndex + ": " + p.content)

      if (p.headingLevel === 2 && p.content === 'Done') {
        doneHeaderLine = i;
      }

      if (p.headingLevel === 2 && p.content === 'Cancelled') {
        cancelledHeaderLine = i;
      }
    } // console.log('  dHL = ' + doneHeaderLine + ', cHL = ' + cancelledHeaderLine);


    const endOfActive = doneHeaderLine > 0 ? doneHeaderLine : cancelledHeaderLine > 0 ? cancelledHeaderLine : lineCount;
    let n = 0;
    let line = '';
    let updatedLine = '';
    let completedDate = '';
    let completedTime = '';
    let reReturnArray = []; // Go through each line in the active part of the file

    for (n = 0; n < endOfActive; n++) {
      const p = paragraphs[n];
      line = p.content;
      updatedLine = '';
      completedDate = ''; // find lines with datetime to shorten, and capture date part of it
      // i.e. @done(YYYY-MM-DD HH:MM[AM|PM])
      // console.log("  [" + n + "] " + line)

      if (p.content.match(RE_DONE_DATE_TIME)) {
        // get completed date and time
        reReturnArray = line.match(RE_DONE_DATE_CAPTURE);
        completedDate = reReturnArray[1];
        completedTime = reReturnArray[2];
        console.log(`  Found completed repeat ${completedDate}/${completedTime} in line ${n}`);
        updatedLine = line.replace(completedTime, ''); // couldn't get a regex to work here

        p.content = updatedLine; // Send the update to the Editor

        await Editor.updateParagraph(p); // console.log('    updated Paragraph ' + p.lineIndex);
        // Test if this is one of my special extended repeats

        if (updatedLine.match(RE_EXTENDED_REPEAT)) {
          let newRepeatDate = '';
          let outline = ''; // get repeat to apply

          reReturnArray = updatedLine.match(RE_EXTENDED_REPEAT_CAPTURE);
          let dateIntervalString = reReturnArray[1];
          console.log(`\tFound EXTENDED @repeat syntax: ${dateIntervalString}`);

          if (dateIntervalString[0] === '+') {
            // New repeat date = completed date + interval
            dateIntervalString = dateIntervalString.substring(1, dateIntervalString.length);
            newRepeatDate = calcOffsetDate(completedDate, dateIntervalString);
            console.log(`\tAdding from completed date --> ${newRepeatDate}`); // Remove any >date

            updatedLine = updatedLine.replace(/\s+>\d{4}-[01]\d{1}-\d{2}/, ''); // i.e. RE_DUE_DATE, but can't get regex to work with variables like this
            // console.log(`\tupdatedLine: ${  updatedLine}`)
          } else {
            // New repeat date = due date + interval
            // look for the due date(>YYYY-MM-DD)
            let dueDate = '';
            const resArray = updatedLine.match(RE_DUE_DATE_CAPTURE) ?? [];
            console.log(resArray.length);

            if (resArray[1] != null) {
              console.log(`\tmatch => ${resArray[1]}`);
              dueDate = resArray[1]; // need to remove the old due date

              updatedLine = updatedLine.replace(`>${dueDate}`, ''); // console.log(updatedLine);
            } else {
              // but if there is no due date then treat that as today
              dueDate = completedDate; // console.log(`\tno match => use completed date ${dueDate}`)
            }

            newRepeatDate = calcOffsetDate(dueDate, dateIntervalString);
            console.log(`\tAdding from due date --> ${newRepeatDate}`);
          }

          outline = updatedLine.replace(/@done\(.*\)/, '').trim(); // Create and add the new repeat line ...

          if (Editor.type === 'Notes') {
            // ...either in same project note
            outline += ` >${newRepeatDate}`; // console.log(`\toutline: ${  outline}`)

            await Editor.insertParagraphAfterParagraph(outline, p, 'scheduled');
            console.log(`\tInserted new para after line ${p.lineIndex}`);
          } else {
            // ... or in the future daily note (prepend)
            // console.log('    -> ' + outline)
            const newRepeatDateShorter = unhyphenateDateString(newRepeatDate);
            const newDailyNote = await DataStore.calendarNoteByDateString(newRepeatDateShorter);

            if (newDailyNote.title != null) {
              // console.log(newDailyNote.filename)
              await newDailyNote.appendTodo(outline);
              console.log(`\tInserted new repeat in daily note ${newRepeatDateShorter}`);
            } else {
              // After a fix to future calendar note creation in r635, we shouldn't get here.
              // But just in case, we'll create new repeat in today's daily note
              outline += ` >${newRepeatDate}`;
              console.log(`\toutline: ${outline}`);
              await Editor.insertParagraphAfterParagraph(outline, p, 'scheduled');
              console.log('\tInserted new repeat in original daily note');
            }
          }
        }
      }
    }
  }

  exports.repeats = repeats;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
