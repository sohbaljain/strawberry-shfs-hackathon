import { CitizenRequestTracker } from "@/app/components/citizen-request-tracker";

export default function CitizenTrackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[] }>;
}) {
  return <CitizenTrackPageContent searchParams={searchParams} />;
}

async function CitizenTrackPageContent({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string | string[] }>;
}) {
  const params = await searchParams;
  const reference = Array.isArray(params.reference) ? params.reference[0] : params.reference;

  return (
    <section className="citizen-page-shell">
      <CitizenRequestTracker initialReference={reference || ""} />
    </section>
  );
}
