require "test_helper"

class EncounterParticipantsControllerTest < ActionDispatch::IntegrationTest
  test "should get update" do
    get encounter_participants_update_url
    assert_response :success
  end
end
