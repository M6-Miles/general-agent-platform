import {redirect} from 'next/navigation';

/** Legacy design demo route; the production dashboard is the only supported entry. */
export default function DemoNewDesignPage() {
  redirect('/');
}
