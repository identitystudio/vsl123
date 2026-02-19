import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { projectId, prompt, images } = await req.json();

    if (!projectId || !prompt || !images) {
      console.warn('Missing required fields:', { projectId: !!projectId, prompt: !!prompt, images: !!images });
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Update project with infographic data
    const { data, error } = await supabase
      .from('vsl_projects')
      .update({
        infographic_prompt: prompt,
        infographic_images: images,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('Infographics saved successfully for project:', projectId);
    return Response.json(data);
  } catch (error) {
    console.error('Save infographics error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: errorMsg || 'Failed to save infographics' },
      { status: 500 }
    );
  }
}
