require "test_helper"

class EncountersControllerTest < ActionDispatch::IntegrationTest
  test "should get show" do
    get encounters_show_url
    assert_response :success
  end
end
