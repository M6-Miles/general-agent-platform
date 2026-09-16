import {redirect} from 'next/navigation';

/** Legacy route kept as a stable redirect for bookmarked URLs. */
export default function ModernAgentsPage() {
  redirect('/agents');
}
