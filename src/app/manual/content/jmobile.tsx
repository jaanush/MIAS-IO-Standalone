export function JMobileSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>JMobile Alarm Numbering</h1>
      <p className="lead text-muted-foreground">
        JMobile is the legacy operator-panel runtime that consumes alarm tables as
        XML. Its alarm-number references are stable identifiers that downstream
        systems (panels in the field, exported configuration) hold onto across IO-list
        edits. The JMobile project tab is where alarm numbers are assigned and locked
        so that those external references survive.
      </p>

      <h2>Where to find it</h2>
      <p>
        Open a project and pick the <strong>JMobile</strong> tab in the left sidebar
        (<code>/projects/[id]/jmobile</code>). The page lists every alarm in the
        project — both discrete and analog — merged into a single table sorted by
        alarm number. Pending alarms (those without a number) appear after the
        numbered ones, ordered by tag.
      </p>

      <h2>The alarm table</h2>
      <p>
        Each row shows:
      </p>
      <ul>
        <li><strong>No.</strong> — the locked alarm number, or em-dash if pending.</li>
        <li><strong>Tag</strong> — the parent signal&apos;s tag.</li>
        <li><strong>Description / Message</strong> — the alarm description and the operator-facing message.</li>
        <li><strong>Kind</strong> — <code>discrete</code> or <code>analog</code>.</li>
        <li><strong>Cond.</strong> — the trigger condition (<code>ON_TRIGGER</code>, <code>OFF_TRIGGER</code>, <code>HIGH</code>, <code>LOW</code>, <code>HIGH_HIGH</code>, <code>LOW_LOW</code>).</li>
        <li><strong>Sev.</strong> — severity (<code>INFO</code>, <code>WARNING</code>, <code>ALARM</code>, <code>CRITICAL</code>).</li>
        <li><strong>Grp.</strong> — alarm group (A, B, C).</li>
        <li><strong>Setpoint</strong> — for analog alarms, the threshold and hysteresis (e.g. <code>80 ±2</code>); em-dash for discrete alarms.</li>
      </ul>
      <p>
        Above the table, four counters give you the project state at a glance: total
        alarms, numbered, awaiting numbering, and the highest currently-assigned
        number. The filter input matches against tag, description, or message; the
        filter dropdown narrows to numbered-only or pending-only.
      </p>

      <h2>Locking numbers</h2>
      <p>
        Click <strong>Lock N pending</strong> to assign sequential integers to every
        alarm whose number is currently <code>NULL</code>. Numbering starts at one
        above the project&apos;s current highest, so new alarms always appear at the
        end of the JMobile import. Existing numbers are <em>never</em> changed by
        this operation — once locked, an alarm number is pinned for life of the
        project.
      </p>
      <p>
        This stability is the whole point. JMobile XML imports reference alarms by
        number, and operators in the field have learned which number means what.
        Renumbering on every edit would break those external references.
      </p>

      <h3>Renumber from scratch</h3>
      <p>
        The <strong>Renumber from scratch</strong> button wipes every alarm number
        and starts over. It exists for clean reseeds — e.g. after a large IO-list
        rework where you accept that all JMobile imports will need redoing. The
        action is gated behind a confirmation dialog and should be used sparingly.
      </p>

      <h2>Pending: XML export</h2>
      <p>
        The actual XML export is gated on the plugin populating
        <code>iec_alarm_path</code> for each alarm — the same way <code>iec_path</code>
        gates Live Monitoring. Once that path is available, MIAS-IO will produce the
        five JMobile artefacts:
      </p>
      <ul>
        <li><strong>ExportedAlarms</strong> — the alarm definitions panel imports.</li>
        <li><strong>AlarmsToExorAlarmSettingsTable</strong> — settings cross-reference table.</li>
        <li><strong>AlarmTexter</strong> — operator messages keyed by alarm number.</li>
        <li><strong>IO_Check</strong> — IO test sheet derived from the alarm condition list.</li>
        <li><strong>MIAS_TagsForLogging</strong> — the per-alarm logging tag list.</li>
      </ul>
      <p>
        See <code>docs/jmobile-export-schema.md</code> for the full schema. Until
        that work lands, the JMobile tab focuses on getting the numbering right —
        which is the part that has to be stable before any export can be useful.
      </p>

      <h2>Relationship to other tabs</h2>
      <p>
        The JMobile tab is read-mostly: it surfaces alarms defined elsewhere
        (<em>Signals → Alarm Configuration</em>) and only writes the
        <code>alarm_no</code> column. To add or change an alarm itself, edit the
        signal it belongs to. The Live Monitoring tab uses the parallel
        <code>iec_path</code> mechanism to stream values; JMobile uses the
        forthcoming <code>iec_alarm_path</code> in the same way.
      </p>
    </article>
  );
}
